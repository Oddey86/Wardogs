"""Render the original aircraft turntable. Run with Blender in background mode."""
import math
import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


def material(name, dark, light=None, metallic=0, rough=.5, scale=6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    tree = m.node_tree
    bs = tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*dark, 1)
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = rough
    if light:
        noise = tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = scale
        noise.inputs['Detail'].default_value = 5
        ramp = tree.nodes.new('ShaderNodeValToRGB')
        for stop, color in zip(ramp.color_ramp.elements, (dark, light)):
            stop.color = (*color, 1)
        tree.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
        tree.links.new(ramp.outputs['Color'], bs.inputs['Base Color'])
        grain = tree.nodes.new('ShaderNodeTexNoise')
        grain.inputs['Scale'].default_value = 155
        grain.inputs['Detail'].default_value = 2
        bump = tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .16
        bump.inputs['Distance'].default_value = .012
        tree.links.new(grain.outputs['Fac'], bump.inputs['Height'])
        tree.links.new(bump.outputs[0], bs.inputs['Normal'])
    return m


def mesh(name, vertices, faces, mat, bevel=0, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    if smooth:
        for f in data.polygons:
            f.use_smooth = True
    if bevel:
        mod = obj.modifiers.new('Rolled seams', 'BEVEL')
        mod.width, mod.segments = bevel, 3
        obj.modifiers.new('Surface normals', 'WEIGHTED_NORMAL')
    return obj


def ellipsoid(name, pos, size, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=pos)
    obj = bpy.context.object
    obj.name, obj.scale = name, size
    obj.data.materials.append(mat)
    for f in obj.data.polygons:
        f.use_smooth = True
    return obj


def bar(name, p, q, radius, mat, end=None):
    p, q = Vector(p), Vector(q)
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=radius, radius2=radius if end is None else end,
        depth=(p-q).length, location=(p+q)*.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (q-p).to_track_quat('Z','Y').to_euler()
    obj.data.materials.append(mat)
    for f in obj.data.polygons:
        f.use_smooth = len(f.vertices)==4
    return obj


def hull(name, stations, mat):
    # Cross sections follow the canopy sill, belly and shoulders of the airframe.
    profile = [(0,1),(.72,.87),(.98,.45),(1,-.26),(.73,-.83),(0,-1),
               (-.73,-.83),(-1,-.26),(-.98,.45),(-.72,.87)]
    verts = [(x,w*y,z+h*v) for x,w,z,h in stations for y,v in profile]
    n = len(profile)
    faces = [(i*n+j,(i+1)*n+j,(i+1)*n+(j+1)%n,i*n+(j+1)%n)
             for i in range(len(stations)-1) for j in range(n)]
    faces += [tuple(range(n-1,-1,-1)),tuple(range(len(verts)-n,len(verts)))]
    return mesh(name, verts, faces, mat, .055, True)


def panel(name, outline, mat, rim):
    mesh(name, outline,[tuple(range(len(outline)))],mat)
    for a,b in zip(outline,outline[1:]+outline[:1]):
        bar('Glazing seal',a,b,.038,rim)


def stencil(text, pos, size, side):
    bpy.ops.object.text_add(location=pos,rotation=(math.pi/2,0,0 if side<0 else math.pi))
    obj=bpy.context.object
    obj.name='Painted marking'
    obj.data.body, obj.data.size, obj.data.space_character=text,size,1.11
    obj.data.materials.append(mark)


def aim(obj, target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def softbox(name,pos,energy,color,size):
    bpy.ops.object.light_add(type='AREA',location=pos)
    obj=bpy.context.object
    obj.name=name
    obj.data.energy,obj.data.color,obj.data.shape,obj.data.size=energy,color,'DISK',size
    aim(obj,(0,0,0))


if __name__ == '__main__':
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    paint=material('Weathered graphite',(.019,.027,.034),(.09,.105,.104),.62,.44)
    lower=material('Slate underside',(.048,.056,.063),(.14,.16,.16),.56,.47)
    black=material('Carbon rubber',(.012,.015,.017),(.035,.042,.043),.12,.62)
    metal=material('Oxidised steel',(.12,.135,.14),(.31,.32,.3),.85,.31)
    glass=material('Smoked blue glazing',(.022,.072,.098),metallic=.68,rough=.125)
    mark=material('Faded ochre ink',(.48,.29,.07),(.7,.51,.19),.25,.53)
    rotor_mat=material('Rotor composite',(.022,.026,.027),(.095,.091,.078),.45,.4)
    hull('Fuselage',[(-4.25,.16,-.15,.18),(-3.85,.45,-.14,.35),(-3.15,.69,-.06,.53),
         (-2.15,.83,.06,.74),(-.8,.93,.16,.94),(.85,.96,.18,1.02),(1.75,.79,.26,.81),
         (2.46,.5,.37,.5),(3.05,.28,.46,.29)],paint)
    hull('Armoured belly',[(-3.77,.35,-.33,.19),(-2.6,.71,-.43,.32),(-1,.88,-.45,.36),
         (1.05,.88,-.43,.36),(2.15,.58,-.2,.3)],lower)
    hull('Tapered tail fairing',[(1.65,.53,.4,.5),(3,.36,.49,.31),(5.1,.19,.79,.19),(6.55,.11,.99,.11)],paint)
    hull('Cockpit surround',[(-3.67,.47,.12,.25),(-3,.63,.47,.43),(-2.12,.73,.52,.44),
         (-1.55,.76,.73,.57),(-.72,.75,.81,.57),(-.31,.72,.61,.4)],paint)
    for s in [-1,1]:
        def pane(points):
            panel('Canopy glass',[(x,s*y,z) for x,y,z in points],glass,black)
        pane([(-3.55,.4,.36),(-3.02,.45,.83),(-2.99,.64,.70),(-3.40,.62,.34)])
        pane([(-3.42,.625,.34),(-2.97,.65,.77),(-2.21,.705,.81),(-2.18,.758,.32)])
        pane([(-2.03,.735,.68),(-1.54,.61,1.22),(-1.44,.724,1.13),(-1.78,.77,.64)])
        pane([(-1.71,.778,.62),(-1.39,.731,1.21),(-.77,.72,1.23),(-.69,.782,.62)])
        pane([(-3.56,0,.39),(-3.01,0,.88),(-3.02,.44,.83),(-3.54,.4,.36)])
        pane([(-2.04,0,.72),(-1.52,0,1.31),(-1.54,.60,1.23),(-2.03,.73,.68)])
        # External nacelles, intake lips and recessed turbine faces.
        ellipsoid('Upper nacelle',(.98,s*.87,.76),(1.37,.45,.48),paint)
        bar('Intake lip',(-.28,s*.88,.77),(-.19,s*.88,.77),.348,metal,.376)
        bar('Intake shadow',(-.305,s*.88,.77),(-.28,s*.88,.77),.303,black)
        ellipsoid('Intake cone',(-.325,s*.88,.77),(.16,.127,.127),metal)
        for k in range(13):
            a=k*math.tau/13
            bar('Turbine vane',(-.32,s*.88+.13*math.cos(a),.77+.13*math.sin(a)),
                (-.32,s*.88+.28*math.cos(a+.19),.77+.28*math.sin(a+.19)),.012,metal)
        bar('Exhaust shroud',(1.89,s*.85,.79),(2.50,s*.92,.84),.36,lower,.29)
        bar('Exhaust throat',(2.50,s*.92,.84),(2.518,s*.921,.841),.244,black)
        for k in range(6):
            x=.28+k*.165
            bar('Stamped cooling grille',(x,s*1.303,.69),(x+.13,s*1.29,.91),.026,black)
        # Door seam, small fasteners and a low profile maintenance step.
        seam=[(-1.78,s*.838,.34),(-.84,s*.922,.34),(-.84,s*.943,-.17),(-1.62,s*.857,-.25)]
        for a,b in zip(seam,seam[1:]+seam[:1]):
            bar('Access panel seam',a,b,.015,black)
        bar('Door handle',(-1.06,s*.948,.23),(-.89,s*.954,.23),.023,metal)
        for k in range(19):
            x=-1.65+k*.17
            ellipsoid('Panel rivet',(x,s*(.85+.081*math.sin((k+1)/20*math.pi)),-.27),(.018,.014,.018),metal)
        # Landing gear with recessed wheel hubs.
        for x,y,z,r in [(-2.77,.55,-.94,.225),(1.23,.91,-1.04,.34)]:
            bar('Landing strut',(x-.2,s*(y-.19),-.36),(x,s*y,z),.055,metal)
            bar('Gear brace',(x+.26,s*(y-.19),-.39),(x,s*y,z),.038,paint)
            bar('Wheel', (x,s*(y-.095),z),(x,s*(y+.095),z),r,black)
            bar('Wheel hub',(x,s*(y+.095),z),(x,s*(y+.11),z),r*.54,metal)
            bar('Hub recess',(x,s*(y+.11),z),(x,s*(y+.12),z),r*.28,black)
        stencil('07',(-.64 if s<0 else .15,s*.973,-.15),.43,s)
        stencil('K E S T R E L',(.36 if s<0 else 1.46,s*.967,-.13),.105,s)
    radome=material('Weathered radome',(.12,.125,.068),(.24,.22,.125),.36,.41)
    ellipsoid('Nose cap',(-4.23,0,-.14),(.18,.22,.18),radome)
    ellipsoid('Nose fairing',(-3.35,0,-.55),(.3,.28,.26),paint)
    # Swept stabiliser and vertical tail fin, built as closed aerofoil sections.
    def foil(name,outline,offset,mat):
        n=len(outline)
        vertices=outline+[tuple(Vector(p)+Vector(offset)) for p in outline]
        return mesh(name,vertices,[tuple(reversed(range(n))),tuple(range(n,2*n))]+
                    [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat,.025)
    foil('Dorsal fin',[(5.73,-.058,.84),(6.34,-.058,2.32),(6.68,-.058,2.35),(6.5,-.058,.79)],
         (0,.116,0),paint)
    foil('Tailplane',[(4.62,-1.52,.7),(5.01,-1.52,.68),(5.15,0,.77),(5.01,1.52,.68),
         (4.62,1.52,.7),(4.49,0,.78)],(0,0,.055),lower)
    for x in [-.18,.92]:
        bar('Top fairing stay',(x,-.37,1.02),(.30,0,1.47),.085,black)
    ellipsoid('Gearbox fairing',(.36,0,1.12),(.72,.55,.33),paint)
    bar('Rotor shaft',(.32,0,1.19),(.32,0,1.78),.114,metal)
    bar('Rotor collar',(.32,0,1.48),(.32,0,1.59),.285,black)
    craft=bpy.data.objects.new('Kestrel airframe',None)
    scene.collection.objects.link(craft)
    for obj in list(scene.objects):
        if obj!=craft: obj.parent=craft
    def rotor(name,pos,radius,n,tail=False):
        hub=bpy.data.objects.new(name,None)
        scene.collection.objects.link(hub)
        hub.parent,hub.location=craft,pos
        if tail: hub.rotation_euler.x=math.pi/2
        spin=bpy.data.objects.new(name+' spin',None)
        scene.collection.objects.link(spin)
        spin.parent=hub
        for k in range(n):
            a=k*math.tau/n
            def pt(x,y,z):
                return ((x*math.cos(a)-y*math.sin(a))*radius,(x*math.sin(a)+y*math.cos(a))*radius,z*radius)
            blade=foil('Tapered blade',[pt(.075,-.015,0),pt(.22,-.03,.004),pt(.88,-.03,.019),
                pt(1,-.05,.018),pt(.995,-.011,.024),pt(.89,.014,.023),pt(.21,.018,.008),pt(.075,.014,0)],(0,0,.016),rotor_mat)
            blade.parent=spin
            joint=bar('Rotor grip',pt(.018,0,0),pt(.15,0,.003),radius*.011,metal)
            joint.parent=spin
            tip=foil('Blade tip marking',[pt(.957,-.039,.025),pt(.978,-.043,.025),pt(.978,-.008,.028),pt(.957,-.006,.028)],(0,0,.005),mark)
            tip.parent=spin
        cap=ellipsoid('Rotor crown',(0,0,.016),(radius*.042,radius*.042,radius*.025),paint)
        cap.parent=spin
        return spin
    main=rotor('Main rotor',(.32,0,1.76),5.86,5)
    tail=rotor('Tail rotor',(6.25,-.14,1.27),1.06,4,True)
    scene.world=bpy.data.worlds.new('High overcast')
    scene.world.color=(.33,.38,.44)
    softbox('Break in cloud',(-5,-2,8),1850,(1,.875,.71),7)
    softbox('Cool horizon',(3,6,3.8),2100,(.62,.77,1),6)
    softbox('Valley bounce',(-3,-6,.4),520,(.66,.76,.85),5)
    bpy.ops.object.camera_add(location=(0,-15,5.15))
    camera=bpy.context.object
    aim(camera,(.36,0,.89))
    camera.data.type='ORTHO'
    camera.data.ortho_scale=15.45
    scene.camera=camera
    scene.render.engine='CYCLES'
    scene.cycles.samples=8
    scene.cycles.use_denoising=True
    scene.render.film_transparent=True
    scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=896,480,100
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    folder=Path(tempfile.gettempdir())/'wardogs-kestrel-frames'
    folder.mkdir(exist_ok=True)
    first_frame = int(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else 0
    for i in range(first_frame, 120):
        phase=math.tau*i/120-.52
        craft.rotation_euler=(.10,.045*math.sin(phase),-phase)
        main.rotation_euler.z=math.tau*i*17/120
        tail.rotation_euler.z=math.tau*i*41/120
        scene.render.filepath=str(folder/f'{i:03}.png')
        bpy.ops.render.render(write_still=True)
