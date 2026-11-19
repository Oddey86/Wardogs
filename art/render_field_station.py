"""Render the home page artwork with Blender in background mode."""
import math
import random
from pathlib import Path
import bpy
from mathutils import Vector

random.seed(27)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def surface(name, color, metallic=0, grain=55):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    tree = material.node_tree
    shader = tree.nodes.get("Principled BSDF")
    shader.inputs["Metallic"].default_value = metallic
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = grain
    noise.inputs["Detail"].default_value = 4
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    for stop, factor in zip(ramp.color_ramp.elements, (.32, 1.5)):
        stop.color = (*[min(c * factor, 1) for c in color], 1)
    tree.links.new(noise.outputs["Fac"], ramp.inputs[0])
    tree.links.new(ramp.outputs[0], shader.inputs["Base Color"])
    tree.links.new(noise.outputs["Fac"], shader.inputs["Roughness"])
    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .2
    bump.inputs["Distance"].default_value = .018
    tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs[0], shader.inputs["Normal"])
    return material


olive = surface("Enamel / olive drab", (.105, .123, .073), .48)
edge = surface("Exposed aluminium", (.32, .32, .26), .9)
rubber = surface("Vulcanised rubber", (.025, .028, .023))
ink = surface("Screen print", (.77, .73, .55))
case = surface("Transport case", (.062, .074, .054), .22)
amber = surface("Amber glass", (.85, .34, .055), .3)
amber.node_tree.nodes.get("Principled BSDF").inputs["Emission Color"].default_value = (.95,.3,.05,1)
amber.node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"].default_value = .8


def block(name, position, size, material, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new("Cast edges", "BEVEL")
        mod.width, mod.segments = bevel, 3
        obj.modifiers.new("Normals", "WEIGHTED_NORMAL")
    return obj


def tube(name, points, radius, material):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions, curve.bevel_depth, curve.bevel_resolution = "3D", radius, 3
    line = curve.splines.new("POLY")
    line.points.add(len(points)-1)
    for p, co in zip(line.points, points):
        p.co = (*co, 1)
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    curve.materials.append(material)


def dial(x, z, radius, length, material, y=-1.21):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=length,
        location=(x,y,z), rotation=(math.pi/2,0,0))
    obj = bpy.context.object
    obj.data.materials.append(material)
    mod = obj.modifiers.new("Rim", "BEVEL")
    mod.width, mod.segments = .012, 3
    obj.modifiers.new("Normals", "WEIGHTED_NORMAL")


def label(text, x, y, z, size, material=ink):
    bpy.ops.object.text_add(location=(x,y,z), rotation=(math.pi/2,0,0))
    obj = bpy.context.object
    obj.data.body, obj.data.size, obj.data.space_character = text, size, 1.15
    obj.data.materials.append(material)


block("Concrete deck", (0,0,-.35),(200,200,.5), surface("Concrete", (.062,.058,.049), .1, 1200))
block("Transit case", (1.9,0,.38),(5.9,3.5,1.05),case,.14)
block("Lid seal",(1.9,0,.83),(5.95,3.54,.09),rubber)
block("Ribbed lid",(1.9,0,.96),(6,3.55,.22),case,.09)
for x in [-.7,-.5, .15,1,2.8,3.6,4.35,4.55]:
    block("Reinforcement",(x,0,1.06),(.12,3.32,.1),case)
for x in [.05,3.8]:
    block("Latch plate",(x,-1.78,.75),(.38,.08,.42),edge)
    block("Latch grip",(x,-1.84,.75),(.27,.09,.27),rubber)
label("FIELD   /   COMMS",1,-1.757,.38,.2)
block("Transceiver chassis",(1.92,0,2),(4.15,2.15,1.8),olive,.16)
block("Face gasket",(1.92,-1.04,2),(4.13,.2,1.76),rubber,.1)
block("Front panel",(1.92,-1.14,2),(4.05,.12,1.67),olive,.085)
for x in [.05,3.8]:
    for z in [1.32,2.69]:
        dial(x,z,.054,.035,edge)
        block("Screw slot",(x,-1.233,z),(.055,.008,.013),rubber,.002)
    tube("Crash bar",[(x,-1.21,1.43),(x,-1.55,1.43),(x,-1.61,1.52),
        (x,-1.61,2.5),(x,-1.55,2.58),(x,-1.21,2.58)],.065,rubber)
for i in range(15):
    block("Cooling fin",(.25+i*.24,0,2.9),(.115,1.8,.095),olive,.025)
for i in range(9):
    block("Speaker grille",(.72,-1.21,1.49+i*.1),(.7,.075,.045),rubber,.02)
label("FIELD TRANSCEIVER",.38,-1.211,2.6,.145)
block("Display bezel",(2.03,-1.22,2.3),(1.42,.14,.49),rubber,.045)
block("Dial display",(2.03,-1.296,2.3),(1.25,.025,.34),amber,.024)
label("046.750",1.55,-1.315,2.21,.25,rubber)
label("CHANNEL",1.41,-1.213,1.94,.08)
for x in [1.5,1.84,2.18,2.52]:
    block("Function key",(x,-1.25,1.67),(.23,.16,.21),rubber)
for z in [1.65,2.37]:
    dial(3.18,z,.26,.1,edge)
    dial(3.18,z,.221,.26,rubber,-1.34)
    for j in range(16):
        a = j * math.tau / 16
        block("Knurl",(3.18+.21*math.cos(a),-1.34,z+.21*math.sin(a)),(.033,.18,.033),rubber,.01)
    block("Dial index",(3.18,-1.476,z+.13),(.028,.01,.093),ink,.003)
for x in [.23,3.62]:
    tube("Whip base",[(x,.72,2.9),(x,.72,3.2)],.11,rubber)
    tube("Whip antenna",[(x,.72,3.2),(x-.22,.78,5.6),(x-.54,.9,7)],.023,edge)
points=[]
for i in range(460):
    t=i/459
    points.append((.18-1.16*t+.075*math.sin(40*math.pi*t),-1.31-.6*math.sin(math.pi*t),
                   2.3-1.03*math.sin(t*math.pi*.55)+.075*math.cos(40*math.pi*t)))
tube("Handset lead",points,.036,rubber)
# Broad softboxes leave long grazing highlights on the textured metal.
def light(name, position, target, power, color, size):
    bpy.ops.object.light_add(type="AREA", location=position)
    obj=bpy.context.object
    obj.name=name
    obj.data.energy,obj.data.color,obj.data.shape,obj.data.size=power,color,"DISK",size
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()

light("Overcast skylight",(1,-4,8),(2,0,1),900,(.75,.85,1),6)
light("Low warm sun",(6,3,5),(1,0,1),2400,(1,.68,.36),3)
light("Bounce",(-4,-2,3),(2,0,1),500,(.68,.76,.81),4)
scene.world=bpy.data.worlds.new("Station ambient")
scene.world.color=(.09,.1,.11)
bpy.ops.object.camera_add(location=(6.3,-10.5,5.3))
camera=bpy.context.object
camera.rotation_euler=(Vector((.35,0,2.0))-camera.location).to_track_quat("-Z","Y").to_euler()
camera.data.lens=42
scene.camera=camera
scene.render.engine="CYCLES"
scene.cycles.samples=20
scene.cycles.use_denoising=True
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=1760,1000,100
scene.render.image_settings.file_format="WEBP"
scene.render.image_settings.quality=88
scene.render.filepath=str(Path(__file__).resolve().parents[1]/"public"/"field-station.webp")
bpy.ops.render.render(write_still=True)
