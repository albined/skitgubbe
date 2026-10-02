"""Export just the suited outfit as a small seated lobby cameo; never saves the source blend.

Run with Blender --background --disable-autoexec INPUT --python SCRIPT -- --output OUTPUT.glb.
The web rig deliberately reduces facial/cloth controls to 19 bones for a distant idle cameo.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source = bpy.data.objects['Kiryu Kazuma_rig']
meshes = [o for c in ('BASE', 'c_am_kiryu') for o in bpy.data.collections[c].objects
          if o.type == 'MESH' and 'shoesoff' not in o.name]
# Map the source rig onto a small conventional hierarchy, retaining its skin weights.
parents = {'root.x': None, 'spine_01.x': 'root.x', 'spine_02.x': 'spine_01.x',
           'neck.x': 'spine_02.x', 'head.x': 'neck.x'}
for side in ('l', 'r'):
    for name, parent in [('shoulder', 'spine_02.x'), ('arm', 'shoulder.'+side),
                         ('forearm', 'arm.'+side), ('hand', 'forearm.'+side),
                         ('thigh', 'root.x'), ('leg', 'thigh.'+side), ('foot', 'leg.'+side)]:
        parents[name+'.'+side] = parent
rest = {n: source.data.bones[n].matrix_local.copy() for n in parents}
heads = {n: source.data.bones[n].head_local.copy() for n in parents}
tails = {n: source.data.bones[n].tail_local.copy() for n in parents}

def smoothstep(low, high, value):
    t = min(1.0, max(0.0, (value-low)/(high-low)))
    return t*t*(3-2*t)

def destination(name):
    if name in parents:
        return name
    side = 'l' if name.endswith('.l') or '_l_' in name else 'r'
    if name.startswith(('arm_', 'kata_', 'ude1_')): return 'arm.'+side
    if name.startswith(('forearm', 'ude2_', 'ude3_', 'elbow_', 'sode')): return 'forearm.'+side
    if any(t in name for t in ('thumb','index','middle','ring','pinky','hand','buki')): return 'hand.'+side
    if name.startswith(('thigh', 'asi2_')): return 'thigh.'+side
    if name.startswith(('leg_', 'suso')): return 'leg.'+side
    if name.startswith(('toes','foot')): return 'foot.'+side
    if name.startswith(('ketu','pocket','center','jks_')): return 'root.x'
    if name.startswith(('eri','munemus','waki','tie','backhair_mune')): return 'spine_02.x'
    if name.startswith('neck') or name == 'backhair_kubi_c_n': return 'neck.x'
    return 'head.x'

for o in meshes:
    # Source meshes have a 180-degree object rotation; preserve it in armature space.
    o.data.transform(source.matrix_world.inverted() @ o.matrix_world)
    if o.name == '[l0]pants2':
        # Coincident vertices on UV seams must share the same smoothing result.
        # UVs remain separate on face corners, so texture seams are preserved.
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
        bm.to_mesh(o.data)
        bm.free()
    weights = []
    for v in o.data.vertices:
        grouped = {}
        for g in v.groups:
            if g.weight <= 0: continue
            target = destination(o.vertex_groups[g.group].name)
            grouped[target] = grouped.get(target, 0) + g.weight
        if o.name == '[l0]pants2':
            # The source trousers include overlapping cloth-support weights. A smooth
            # hip/knee blend avoids their folded triangles after removing those controls.
            z = v.co.z
            thigh = 1-smoothstep(.82, 1.055, z)
            shin = 1-smoothstep(.45, .65, z)
            foot = 1-smoothstep(.06, .16, z)
            # Blend across the inner seam as well as vertically. A hard left/right
            # assignment pulls adjacent crotch vertices apart when the knees open.
            left = smoothstep(-.065, .065, v.co.x)
            grouped = {'root.x': 1-thigh}
            for side, blend in [('l',left), ('r',1-left)]:
                grouped['thigh.'+side] = blend*thigh*(1-shin)
                grouped['leg.'+side] = blend*thigh*shin*(1-foot)
                grouped['foot.'+side] = blend*thigh*shin*foot
        weights.append(grouped)
    o.vertex_groups.clear()
    groups = {n:o.vertex_groups.new(name=n) for n in parents}
    for i, grouped in enumerate(weights):
        for n, w in grouped.items(): groups[n].add([i],w,'REPLACE')
    if o.name == '[l0]pants2':
        # Smooth only the compressed front hip fabric after posing. Keep the
        # waistband and leg silhouettes fixed so this is not a whole-mesh shrink.
        crease = o.vertex_groups.new(name='Seated trouser crease')
        for v in o.data.vertices:
            x,y,z = v.co
            weight = ((1-smoothstep(.12,.24,abs(x))) * smoothstep(.78,.86,z)
                      * (1-smoothstep(1.015,1.075,z)) * (1-smoothstep(0,.08,y)))
            if weight > 0: crease.add([v.index],weight,'REPLACE')
    o.modifiers.clear()
    o.parent = None
    o.matrix_world = Matrix.Identity(4)
    if o.data.shape_keys:
        o.shape_key_clear()

# Delete unrelated outfits, UI helpers, lights and the original control rigs.
for o in list(bpy.data.objects):
    if o not in meshes: bpy.data.objects.remove(o, do_unlink=True)
arm = bpy.data.armatures.new('Cameo skeleton')
rig = bpy.data.objects.new('Kiryu seated',arm)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for n,p in parents.items():
    b=arm.edit_bones.new(n)
    b.head=heads[n]; b.tail=tails[n]
    b.align_roll(rest[n].to_3x3().col[2])
    if p: b.parent=arm.edit_bones[p]
bpy.ops.object.mode_set(mode='OBJECT')
for o in meshes:
    o.parent=rig
    mod=o.modifiers.new('Cameo skin','ARMATURE');mod.object=rig
    if o.name == '[l0]pants2':
        smooth=o.modifiers.new('Relax seated trouser crease','SMOOTH')
        smooth.vertex_group='Seated trouser crease'
        smooth.factor=.5
        smooth.iterations=12
    if len(o.data.polygons) > 1000:
        simplify=o.modifiers.new('Mobile geometry','DECIMATE')
        simplify.ratio=.8 if 'face' in o.name else .6

# Aim limbs in armature space; retain the source bone roll to avoid twisting sleeves.
def aim(name, direction):
    bpy.context.view_layer.update()
    b=rig.pose.bones[name]
    rotation=(tails[name]-heads[name]).normalized().rotation_difference(Vector(direction).normalized())
    m=(rotation.to_matrix() @ rest[name].to_3x3()).to_4x4()
    m.translation=b.head
    b.matrix=m
    bpy.context.view_layer.update()

# Settle into the backrest with a slightly uneven posture instead of a rigid,
# symmetrical upright sit. Aim arms after the spine so hands still rest on thighs.
aim('spine_01.x',(.025,.28,1))
aim('spine_02.x',(-.01,.20,1))
aim('neck.x',(0,.035,1))
aim('head.x',(0,-.025,1))
for s,sign in [('l',1),('r',-1)]:
    aim('thigh.'+s,(sign*.075,-.445,-.025 if s=='l' else -.045))
    aim('leg.'+s,(sign*.025,-.085 if s=='l' else -.045,-.445))
    aim('foot.'+s,(0,-.136,-.06))
    aim('arm.'+s,(sign*.06,-.10,-.27))
    aim('forearm.'+s,(-sign*.025,-.20,-.18 if s=='l' else -.22))
    aim('hand.'+s,(-sign*.01,-.095,-.025))
rig.location.z=-.38

used_materials={m for o in meshes for m in o.data.materials if m}
used_images=set()
for material in used_materials:
    nodes=material.node_tree.nodes
    diffuse=next((n.image for n in nodes if n.type=='TEX_IMAGE' and n.image and '_di.' in n.image.name),None)
    nodes.clear()
    output=nodes.new('ShaderNodeOutputMaterial')
    shader=nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Roughness'].default_value=.85
    material.node_tree.links.new(shader.outputs['BSDF'],output.inputs['Surface'])
    if diffuse:
        used_images.add(diffuse)
        image_node=nodes.new('ShaderNodeTexImage');image_node.image=diffuse
        material.node_tree.links.new(image_node.outputs['Color'],shader.inputs['Base Color'])
        if any(t in material.name for t in ['hair','mayu','eyelashes']):
            material.node_tree.links.new(image_node.outputs['Alpha'],shader.inputs['Alpha'])
            material.surface_render_method='DITHERED'
for im in used_images:
    w,h=im.size
    if max(w,h)>512: im.scale(round(w*512/max(w,h)),round(h*512/max(w,h)))
    im.pack()

bpy.ops.object.select_all(action='DESELECT')
for o in meshes+[rig]:o.hide_set(False);o.hide_render=False;o.select_set(True)
bpy.context.view_layer.objects.active=rig
# Pose becomes the rest pose, allowing tiny runtime motion around this seated baseline.
# Bake mesh deformation first, then apply the exact same pose to the rest skeleton.
depsgraph=bpy.context.evaluated_depsgraph_get()
for o in meshes:
    evaluated=o.evaluated_get(depsgraph)
    baked=bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
    if o.name == '[l0]pants2':
        # Original split normals describe standing trousers, not the relaxed fold.
        baked.normals_split_custom_set([(0,0,0)] * len(baked.loops))
    o.data=baked
    for modifier in list(o.modifiers):
        if modifier.type in {'DECIMATE','SMOOTH'}: o.modifiers.remove(modifier)
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
Path(args.output).parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=args.output,export_format='GLB',use_selection=True,
    export_animations=False,export_morph=False,export_image_format='JPEG',export_image_quality=82,
    export_yup=True,export_cameras=False,export_lights=False,export_extras=False)
print('CAMEO_EXPORT',json.dumps({'bytes':Path(args.output).stat().st_size,'bones':len(parents),
    'meshes':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'textures':len(used_images)}))
