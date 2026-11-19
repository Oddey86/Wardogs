"""Render the alpine valley backplate used behind the helicopter."""
import math
import random
from pathlib import Path
import bpy
from mathutils import Vector, noise

random.seed(8107)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def chamfer(name, vertices, faces, material):
    geo = bpy.data.meshes.new(name)
    geo.from_pydata(vertices, [], faces)
    geo.update()
    obj = bpy.data.objects.new(name, geo)
    bpy.context.collection.objects.link(obj)
    geo.materials.append(material)
    return obj


def surface(name, color, alternate, texture_scale=.8, reflect=.84):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    tree=mat.node_tree
    shader=tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value=reflect
    coords=tree.nodes.new('ShaderNodeTexCoord')
    tex=tree.nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value=texture_scale
    tex.inputs['Detail'].default_value=6
    tree.links.new(coords.outputs['Object'],tex.inputs[0])
    ramp=tree.nodes.new('ShaderNodeValToRGB')
    for e,c in zip(ramp.color_ramp.elements,(color,alternate)):
        e.color=(*c,1)
    tree.links.new(tex.outputs['Fac'],ramp.inputs[0])
    tree.links.new(ramp.outputs[0],shader.inputs['Base Color'])
    bump=tree.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value=.29
    bump.inputs['Distance'].default_value=.18
    tree.links.new(tex.outputs['Fac'],bump.inputs['Height'])
    tree.links.new(bump.outputs[0],shader.inputs['Normal'])
    # Aerial perspective is applied consistently to hills, forests and water.
    depth=tree.nodes.new('ShaderNodeCameraData')
    remap=tree.nodes.new('ShaderNodeMapRange')
    remap.inputs['From Min'].default_value=24
    remap.inputs['From Max'].default_value=330
    remap.inputs['To Max'].default_value=.91
    tree.links.new(depth.outputs['View Distance'],remap.inputs[0])
    haze=tree.nodes.new('ShaderNodeEmission')
    haze.inputs['Color'].default_value=(.36,.44,.49,1)
    mix=tree.nodes.new('ShaderNodeMixShader')
    tree.links.new(remap.outputs[0],mix.inputs[0])
    tree.links.new(shader.outputs[0],mix.inputs[1])
    tree.links.new(haze.outputs[0],mix.inputs[2])
    tree.links.new(mix.outputs[0],tree.nodes.get('Material Output').inputs[0])
    return mat


def channel(y):
    return 6+9*math.sin(y*.056)+6*math.sin(y*.029+.4)


def terrain(x,y):
    d=abs(x-channel(y))
    ridge=min(1,max(0,(d-3.7)/38))
    n=noise.fractal(Vector((x*.037,y*.037,1.23)),1.05,2.17,6)
    broad=noise.noise_vector(Vector((x*.013,y*.017,3.5))).x
    peaks=(19+12*math.sin(y*.071+x*.025)+11*broad+14*n)
    high=max(0,(y-91)*.14)
    return -.35+max(0, d-2.8)*.049+ridge*max(2,peaks)+high*(.65+.55*n)


earth=surface('Shale and moss',(.055,.067,.064),(.30,.31,.26),1.7)
pine=surface('Forest canopy',(.019,.035,.034),(.10,.14,.11),2)
water=surface('Glacial water',(.078,.19,.22),(.29,.39,.39),.45,.22)
verts=[]; faces=[]
nx,ny=225,285
for j in range(ny):
    y=-66+j*1.12
    for i in range(nx):
        x=(i-nx/2)*1.23
        verts.append((x,y,terrain(x,y)))
        if i and j:
            k=j*nx+i
            faces.append((k-nx-1,k-nx,k,k-1))
land=chamfer('Glacial valley',verts,faces,earth)
for p in land.data.polygons: p.use_smooth=True
verts=[]; faces=[]
for i in range(515):
    y=-65+i*.35
    width=2.9+1.3*math.sin(y*.12+.4)
    for s in [-1,1]: verts.append((channel(y)+s*width,y,-.11))
    if i: faces.append((i*2-2,i*2-1,i*2+1,i*2))
chamfer('River',verts,faces,water)
# Tree clusters vary in density with altitude and disappear on exposed rock.
verts=[]; faces=[]
for k in range(70000):
    x,y=random.uniform(-100,100),random.uniform(-51,160)
    z=terrain(x,y)
    if abs(x-channel(y))<4 or z>23+4*math.sin(x*.13+y*.10): continue
    patch=noise.noise_vector(Vector((x*.1,y*.1,5))).z
    if patch<-.18 or (patch<.12 and random.random()<.62): continue
    h=random.uniform(.7,1.95)
    r=h*random.uniform(.19,.28)
    for tier,(level,rad) in enumerate([(.04,1),(.32,.8),(.54,.55),(.73,.32)]):
        crown=len(verts)
        verts.append((x,y,z+h*min(1,level+.38)))
        for j in range(8):
            a=j*math.tau/8+k+tier*.64
            radius=r*rad*(1 if j%2 else .55)
            verts.append((x+radius*math.cos(a),y+radius*math.sin(a),z+h*(level+.07*(j%2))))
        for j in range(8): faces.append((crown,crown+1+j,crown+1+(j+1)%8))
chamfer('Spruce forest',verts,faces,pine)
scene.world=bpy.data.worlds.new('Coastal overcast')
scene.world.use_nodes=True
tree=scene.world.node_tree
tex=tree.nodes.new('ShaderNodeTexNoise')
tex.inputs['Scale'].default_value=3.2
tex.inputs['Detail'].default_value=6
coord=tree.nodes.new('ShaderNodeTexCoord')
tree.links.new(coord.outputs['Generated'],tex.inputs[0])
ramp=tree.nodes.new('ShaderNodeValToRGB')
for e,c in zip(ramp.color_ramp.elements,[(.3,.39,.48,1),(1.25,1.30,1.28,1)]):
    e.color=c
tree.links.new(tex.outputs['Fac'],ramp.inputs[0])
tree.links.new(ramp.outputs[0],tree.nodes.get('Background').inputs[0])
bpy.ops.object.light_add(type='SUN',rotation=(math.radians(61),math.radians(-25),math.radians(-43)))
sun=bpy.context.object.data
sun.energy,sun.angle,sun.color=3,math.radians(7),(1,.89,.72)
bpy.ops.object.camera_add(location=(15,-58,43))
camera=bpy.context.object
camera.rotation_euler=(Vector((-4,45,11))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.lens,camera.data.clip_end=34,500
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=8
scene.cycles.use_denoising=True
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=1800,1050,100
scene.render.image_settings.file_format='WEBP'
scene.render.image_settings.quality=89
scene.render.filepath=str(Path(__file__).resolve().parents[1]/'public'/'air-patrol-valley.webp')
bpy.ops.render.render(write_still=True)
