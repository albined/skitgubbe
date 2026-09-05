"""Prepare Serena.blend for a lightweight, interactive lobby background.

Run this script through Blender, passing arguments after ``--``. It never saves
over the input file: the editable web copy and exported GLB are explicit output
paths.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector


CAMERA_CULL_TRANSLATION_METERS = 0.15
CAMERA_PREVIEW_TRANSLATION_METERS = 0.10
FRUSTUM_MARGIN = 0.35
LARGE_OBJECT_METERS = 6.0


def parse_args() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-blend", required=True)
    parser.add_argument("--output-glb", required=True)
    parser.add_argument(
        "--output-lightmap",
        help="WebP lightmap path. Defaults to serena-room-lightmap.webp beside the GLB.",
    )
    parser.add_argument("--preview-dir", required=True)
    parser.add_argument(
        "--bake-size",
        type=int,
        default=2048,
        help="Square baked-lighting texture size. Use 0 to export dynamic PBR materials instead.",
    )
    parser.add_argument(
        "--bake-samples",
        type=int,
        default=128,
        help="Cycles samples for the static lighting bake.",
    )
    return parser.parse_args(arguments)


def input_by_name(node: bpy.types.Node, *names: str):
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            return socket
    return None


def linked_group_images(material: bpy.types.Material) -> dict[str, bpy.types.Image]:
    images: dict[str, bpy.types.Image] = {}
    if material.node_tree is None:
        return images

    for link in material.node_tree.links:
        if link.from_node.type != "TEX_IMAGE" or link.to_node.type != "GROUP":
            continue
        if link.from_node.image is not None:
            images[link.to_socket.name] = link.from_node.image
    return images


def material_characteristics(material: bpy.types.Material) -> tuple[float, float, bool]:
    name = material.name.lower()
    glass = any(token in name for token in ("glas", "glass"))
    metal = any(token in name for token in ("gold", "silv", "metal", "steel", "brass"))
    soft = any(token in name for token in ("carp", "sofa", "leath", "cloth", "fabric"))
    glossy = any(token in name for token in ("marb", "tile", "glas", "glass"))

    metallic = 0.72 if metal else 0.0
    if glass:
        roughness = 0.12
    elif glossy:
        roughness = 0.3
    elif soft:
        roughness = 0.78
    else:
        roughness = 0.58
    return metallic, roughness, glass


def convert_material(
    material: bpy.types.Material, *, include_normal: bool = True
) -> dict[str, object]:
    source_images = linked_group_images(material)
    diffuse = source_images.get("texture_diffuse")
    normal = source_images.get("texture_normal") if include_normal else None
    diffuse_alpha_linked = "Diffuse Alpha" in source_images
    metallic, roughness, glass = material_characteristics(material)

    material.use_nodes = True
    node_tree = material.node_tree
    assert node_tree is not None
    node_tree.nodes.clear()

    output = node_tree.nodes.new("ShaderNodeOutputMaterial")
    output.location = (520, 0)
    principled = node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    principled.location = (180, 0)
    node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])

    metallic_socket = input_by_name(principled, "Metallic")
    roughness_socket = input_by_name(principled, "Roughness")
    if metallic_socket is not None:
        metallic_socket.default_value = metallic
    if roughness_socket is not None:
        roughness_socket.default_value = roughness

    if diffuse is not None:
        try:
            diffuse.colorspace_settings.name = "sRGB"
        except TypeError:
            pass
        diffuse_node = node_tree.nodes.new("ShaderNodeTexImage")
        diffuse_node.name = "Web Base Color"
        diffuse_node.label = "Web Base Color"
        diffuse_node.image = diffuse
        diffuse_node.interpolation = "Linear"
        diffuse_node.location = (-420, 100)
        base_color = input_by_name(principled, "Base Color")
        if base_color is not None:
            node_tree.links.new(diffuse_node.outputs["Color"], base_color)

        alpha_socket = input_by_name(principled, "Alpha")
        if alpha_socket is not None and (diffuse_alpha_linked or glass):
            node_tree.links.new(diffuse_node.outputs["Alpha"], alpha_socket)
            if hasattr(material, "surface_render_method"):
                material.surface_render_method = "DITHERED"
            elif hasattr(material, "blend_method"):
                material.blend_method = "BLEND"

    if normal is not None:
        try:
            normal.colorspace_settings.name = "Non-Color"
        except TypeError:
            pass
        normal_texture = node_tree.nodes.new("ShaderNodeTexImage")
        normal_texture.name = "Web Normal"
        normal_texture.label = "Web Normal"
        normal_texture.image = normal
        normal_texture.interpolation = "Linear"
        normal_texture.location = (-420, -180)
        normal_map = node_tree.nodes.new("ShaderNodeNormalMap")
        normal_map.location = (-100, -180)
        normal_map.inputs["Strength"].default_value = 0.45
        node_tree.links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
        normal_socket = input_by_name(principled, "Normal")
        if normal_socket is not None:
            node_tree.links.new(normal_map.outputs["Normal"], normal_socket)

    if glass:
        transmission = input_by_name(principled, "Transmission Weight", "Transmission")
        ior = input_by_name(principled, "IOR")
        if transmission is not None:
            transmission.default_value = 0.45
        if ior is not None:
            ior.default_value = 1.45

    material["web_material_conversion"] = "principled-v1"
    return {
        "name": material.name,
        "diffuse": diffuse.name if diffuse else None,
        "normal": normal.name if normal else None,
        "metallic": metallic,
        "roughness": roughness,
        "glass": glass,
    }


def camera_sample_matrices(camera: bpy.types.Object) -> list[Matrix]:
    base = camera.matrix_world.copy()
    offsets = (-CAMERA_CULL_TRANSLATION_METERS, 0.0, CAMERA_CULL_TRANSLATION_METERS)
    return [base @ Matrix.Translation((horizontal, vertical, 0.0)) for horizontal in offsets for vertical in offsets]


def object_intersects_camera_range(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    obj: bpy.types.Object,
    sample_matrices: list[Matrix],
) -> bool:
    if obj.type != "MESH" or not obj.bound_box:
        return True
    if max(obj.dimensions) >= LARGE_OBJECT_METERS:
        return True

    original_matrix = camera.matrix_world.copy()
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    try:
        for camera_matrix in sample_matrices:
            camera.matrix_world = camera_matrix
            projected = [world_to_camera_view(scene, camera, corner) for corner in corners]
            in_front = [point for point in projected if point.z > camera.data.clip_start]
            if not in_front:
                continue
            if len(in_front) != len(projected):
                return True

            minimum_x = min(point.x for point in in_front)
            maximum_x = max(point.x for point in in_front)
            minimum_y = min(point.y for point in in_front)
            maximum_y = max(point.y for point in in_front)
            if (
                maximum_x >= -FRUSTUM_MARGIN
                and minimum_x <= 1.0 + FRUSTUM_MARGIN
                and maximum_y >= -FRUSTUM_MARGIN
                and minimum_y <= 1.0 + FRUSTUM_MARGIN
            ):
                return True
    finally:
        camera.matrix_world = original_matrix
    return False


def cull_outside_camera_range(scene: bpy.types.Scene, camera: bpy.types.Object) -> list[dict[str, object]]:
    sample_matrices = camera_sample_matrices(camera)
    culled = []
    for obj in scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        if object_intersects_camera_range(scene, camera, obj, sample_matrices):
            continue
        obj.hide_render = True
        obj.hide_viewport = True
        culled.append(
            {
                "name": obj.name,
                "polygons": len(obj.data.polygons),
                "dimensions": [round(value, 4) for value in obj.dimensions],
            }
        )
    return culled


def render_previews(scene: bpy.types.Scene, camera: bpy.types.Object, directory: str) -> list[str]:
    Path(directory).mkdir(parents=True, exist_ok=True)
    original_camera_matrix = camera.matrix_world.copy()
    original_engine = scene.render.engine
    original_resolution = (
        scene.render.resolution_x,
        scene.render.resolution_y,
        scene.render.resolution_percentage,
    )
    original_filepath = scene.render.filepath
    original_format = scene.render.image_settings.file_format

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 360
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"

    variations = {
        "center": (0.0, 0.0),
        "left": (-CAMERA_PREVIEW_TRANSLATION_METERS, 0.0),
        "right": (CAMERA_PREVIEW_TRANSLATION_METERS, 0.0),
        "down": (0.0, -CAMERA_PREVIEW_TRANSLATION_METERS),
        "up": (0.0, CAMERA_PREVIEW_TRANSLATION_METERS),
    }
    outputs = []
    try:
        for name, (horizontal, vertical) in variations.items():
            camera.matrix_world = original_camera_matrix @ Matrix.Translation(
                (horizontal, vertical, 0.0)
            )
            output = os.path.join(directory, f"serena-web-{name}.png")
            scene.render.filepath = output
            bpy.ops.render.render(write_still=True)
            outputs.append(output)
    finally:
        camera.matrix_world = original_camera_matrix
        scene.render.engine = original_engine
        (
            scene.render.resolution_x,
            scene.render.resolution_y,
            scene.render.resolution_percentage,
        ) = original_resolution
        scene.render.filepath = original_filepath
        scene.render.image_settings.file_format = original_format
    return outputs


def join_export_geometry(scene: bpy.types.Scene, camera: bpy.types.Object) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    meshes = [
        obj
        for obj in scene.objects
        if obj.type == "MESH" and not obj.hide_render and not obj.hide_viewport
    ]
    if not meshes:
        raise RuntimeError("No renderable mesh objects remain for export.")

    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    if joined is None:
        raise RuntimeError("Blender did not return joined export geometry.")
    joined.name = "SerenaRoomGeometry"
    world_matrix = joined.matrix_world.copy()
    joined.parent = None
    joined.matrix_world = world_matrix

    camera_matrix = camera.matrix_world.copy()
    camera.parent = None
    camera.matrix_world = camera_matrix
    return joined


def bake_lightmap(
    scene: bpy.types.Scene,
    joined: bpy.types.Object,
    size: int,
    samples: int,
    output_path: str,
) -> dict[str, object]:
    """Bake only illumination, retaining the original sharp diffuse textures.

    Lighting is intentionally kept separate from surface color. It changes
    slowly across the room and tolerates a shared atlas; labels, fabric, wood,
    and marble continue to use their original texture resolution at runtime.
    """

    started = time.monotonic()
    bpy.context.view_layer.objects.active = joined
    joined.select_set(True)

    mesh = joined.data
    if not mesh.uv_layers:
        raise RuntimeError("The joined room has no source UV map.")
    source_uv_name = mesh.uv_layers.active.name
    bake_uv = mesh.uv_layers.get("WebLightmap") or mesh.uv_layers.new(name="WebLightmap")
    bake_uv_name = bake_uv.name
    mesh.uv_layers.active = bake_uv
    mesh.uv_layers.active_index = list(mesh.uv_layers).index(bake_uv)

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(66.0),
        island_margin=max(2.0 / size, 0.0005),
        area_weight=0.25,
        correct_aspect=True,
        scale_to_bounds=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")

    image = bpy.data.images.new(
        "SerenaRoomLightmap",
        width=size,
        height=size,
        alpha=False,
        float_buffer=False,
    )
    image.generated_color = (0.0, 0.0, 0.0, 1.0)
    try:
        image.colorspace_settings.name = "sRGB"
    except TypeError:
        pass

    source_materials = [material for material in mesh.materials if material is not None]
    for material in source_materials:
        material.use_nodes = True
        node_tree = material.node_tree
        if node_tree is None:
            continue
        for node in node_tree.nodes:
            node.select = False
        target = node_tree.nodes.new("ShaderNodeTexImage")
        target.name = "Web Lighting Bake Target"
        target.label = "Web Lighting Bake Target"
        target.image = image
        target.select = True
        node_tree.nodes.active = target

    original_engine = scene.render.engine
    original_samples = scene.cycles.samples
    original_bake_margin = scene.render.bake.margin
    original_bake_clear = scene.render.bake.use_clear
    try:
        scene.render.engine = "CYCLES"
        scene.cycles.samples = max(1, samples)
        scene.render.bake.margin = max(8, round(size / 256))
        scene.render.bake.use_clear = True
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"})
    finally:
        scene.render.engine = original_engine
        scene.cycles.samples = original_samples
        scene.render.bake.margin = original_bake_margin
        scene.render.bake.use_clear = original_bake_clear

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    image.filepath_raw = output_path
    image.file_format = "WEBP"
    image.save()
    image.pack()

    # Keep exactly the source texture UV and the baked-lighting UV. Three.js
    # addresses these as channels 0 and 1; the other legacy sets cost several
    # megabytes after glTF vertex splitting and are unused by this room.
    for uv_layer in list(mesh.uv_layers):
        if uv_layer.name not in {source_uv_name, bake_uv_name}:
            mesh.uv_layers.remove(uv_layer)
    source_uv = mesh.uv_layers.get(source_uv_name)
    bake_uv = mesh.uv_layers.get(bake_uv_name)
    if source_uv is None or bake_uv is None:
        raise RuntimeError("A required UV layer disappeared while pruning legacy UVs.")
    source_uv.name = "UVMap"
    bake_uv.name = "Lightmap"
    mesh.uv_layers.active = source_uv
    mesh.uv_layers.active_index = list(mesh.uv_layers).index(source_uv)
    for color_attribute in list(mesh.color_attributes):
        mesh.color_attributes.remove(color_attribute)

    joined["web_lightmapped"] = True
    joined["web_bake_size"] = size
    joined["web_bake_samples"] = samples

    return {
        "image": output_path,
        "bytes": os.path.getsize(output_path),
        "size": size,
        "samples": samples,
        "seconds": round(time.monotonic() - started, 2),
        "source_materials": len(source_materials),
        "source_uv": source_uv.name,
        "lightmap_uv": bake_uv.name,
    }


def export_glb(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    filepath: str,
    joined: bpy.types.Object | None = None,
) -> dict[str, object]:
    Path(filepath).parent.mkdir(parents=True, exist_ok=True)
    if joined is None:
        joined = join_export_geometry(scene, camera)
    bpy.ops.object.select_all(action="DESELECT")
    joined.select_set(True)
    camera.select_set(True)
    bpy.context.view_layer.objects.active = joined

    result = bpy.ops.export_scene.gltf(
        filepath=filepath,
        check_existing=False,
        export_format="GLB",
        use_selection=True,
        export_cameras=True,
        export_lights=False,
        export_animations=False,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_quality=90,
        export_image_webp_fallback=False,
        export_texcoords=True,
        export_normals=not bool(joined.get("web_lightmapped")),
        export_tangents=not bool(joined.get("web_lightmapped")),
        export_attributes=False,
        export_skins=False,
        export_morph=False,
        export_extras=True,
        export_apply=True,
        export_yup=True,
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"GLB export failed: {result}")

    return {
        "filepath": filepath,
        "bytes": os.path.getsize(filepath),
        "polygons": len(joined.data.polygons),
        "vertices": len(joined.data.vertices),
        "material_slots": len(joined.material_slots),
    }


def main() -> None:
    args = parse_args()
    scene = bpy.context.scene
    source_filepath = bpy.data.filepath
    camera = scene.camera
    if camera is None or camera.type != "CAMERA":
        raise RuntimeError("The scene needs an active camera before web export.")

    scene["web_export_version"] = 3
    scene["web_camera_translation_meters"] = 0.06
    scene["web_camera_rotation_degrees"] = 0.55
    camera["web_base_camera"] = True

    material_report = [
        {
            "name": material.name,
            "images": linked_group_images(material),
        }
        for material in bpy.data.materials
    ]
    culled = cull_outside_camera_range(scene, camera)

    output_blend = os.path.abspath(args.output_blend)
    Path(output_blend).parent.mkdir(parents=True, exist_ok=True)
    previews = render_previews(scene, camera, os.path.abspath(args.preview_dir))
    bake_report = None
    joined = None
    if args.bake_size > 0:
        joined = join_export_geometry(scene, camera)
        output_lightmap = os.path.abspath(
            args.output_lightmap
            or os.path.join(os.path.dirname(os.path.abspath(args.output_glb)), "serena-room-lightmap.webp")
        )
        bake_report = bake_lightmap(
            scene,
            joined,
            args.bake_size,
            args.bake_samples,
            output_lightmap,
        )
        material_report = [
            convert_material(material, include_normal=False) for material in bpy.data.materials
        ]
    else:
        material_report = [convert_material(material) for material in bpy.data.materials]

    bpy.ops.wm.save_as_mainfile(filepath=output_blend, check_existing=False)
    export_report = export_glb(
        scene,
        camera,
        os.path.abspath(args.output_glb),
        joined=joined,
    )

    report = {
        "source": source_filepath,
        "editable_web_copy": output_blend,
        "materials_converted": len(material_report),
        "materials_with_diffuse": sum(
            1
            for item in material_report
            if item.get("diffuse") or item.get("images", {}).get("texture_diffuse")
        ),
        "materials_with_normal": sum(
            1
            for item in material_report
            if item.get("normal") or item.get("images", {}).get("texture_normal")
        ),
        "culled_meshes": len(culled),
        "culled_polygons": sum(item["polygons"] for item in culled),
        "culled_objects": culled,
        "previews": previews,
        "bake": bake_report,
        "glb": export_report,
    }
    print("SERENA_WEB_EXPORT_BEGIN")
    print(json.dumps(report, indent=2, sort_keys=True))
    print("SERENA_WEB_EXPORT_END")


if __name__ == "__main__":
    main()
