# Builds app/models/body.glb from the BodyParts3D download. How to run it: app/models/README.md
#   pip install trimesh fast-simplification numpy
#   python3 tools/build_body_model.py <bodyparts3d folder> app/models/body.glb
# The folder must hold isa_BP3D_4.0_obj_99/ (unzipped) and isa_element_parts.txt.
import csv, sys, json, re, glob, os, numpy as np, trimesh, fast_simplification as fs
SRC=sys.argv[1]
D=SRC+'/isa_BP3D_4.0_obj_99/'
rows=list(csv.reader(open(SRC+'/isa_element_parts.txt'),delimiter='\t'))[1:]
concept={}
for c,n,f in rows: concept.setdefault(c,set()).add(f)
# Each OBJ file says in its header which body part it is ("# English name : ...")
names={}
for path in glob.glob(D+'*.obj'):
    with open(path) as fh:
        for line in fh:
            if line.startswith('# English name :'): names[os.path.basename(path)[:-4]]=line.split(':',1)[1].strip(); break
            if not line.startswith('#'): break
def by_name(rx): return sorted(k for k,n in names.items() if re.search(rx,n,re.I))
bones=concept['FMA5018']|concept['FMA7591']
spine_rx=r'vertebra$|^(Atlas|Axis)$|^Sacrum$|^Coccyx$|hip bone'
spine={b for b in bones if b in names and re.search(spine_rx,names[b],re.I) and 'disk' not in names[b].lower()}
spine|=set(by_name(r'^Intervertebral disk'))
groups={
 'skeleton': sorted(b for b in bones if b not in spine),
 'spine': sorted(spine),
 'skin': ['FJ2810'],
 'heart': by_name(r'^Wall of (ventricle|left atrium|right atrium)$'),
 'brain': by_name(r'^White matter of (left|right) cerebral hemisphere$|^Cerebellum$|^Midbrain$|^Pons$'),
 'eyes': by_name(r'^(Left|Right) (sclera|cornea)$'),
 'muscle': by_name(r'^(Left|Right) (rectus femoris|vastus (lateralis|medialis|intermedius))$'),
}
target={'skeleton':110000,'spine':30000,'skin':24000,'heart':8000,'brain':14000,'eyes':2500,'muscle':10000}
skin=trimesh.load(D+'FJ2810.obj',force='mesh',process=False)
cx=(skin.bounds[0][0]+skin.bounds[1][0])/2; cy=(skin.bounds[0][1]+skin.bounds[1][1])/2; z0=skin.bounds[0][2]
def conv(v): # BodyParts3D mm (x=left, y=back, z=up) -> metres, y up, facing +z
    return np.c_[(v[:,0]-cx), (v[:,2]-z0), -(v[:,1]-cy)]/1000.0
scene=trimesh.Scene(); info={}
for g,files in groups.items():
    vs=[];fs_=[];off=0
    for f in files:
        try: m=trimesh.load(D+f+'.obj',force='mesh',process=False)
        except Exception as e: print('skip',f,e); continue
        vs.append(conv(np.asarray(m.vertices))); fs_.append(np.asarray(m.faces)+off); off+=len(m.vertices)
    V=np.vstack(vs); F=np.vstack(fs_)
    ratio=max(0.0,1-target[g]/len(F))
    if ratio>0: V,F=fs.simplify(V.astype(np.float32),F.astype(np.int32),target_reduction=ratio)
    mesh=trimesh.Trimesh(V,F,process=True)
    mesh.visual=trimesh.visual.ColorVisuals(mesh)
    scene.add_geometry(mesh,node_name=g,geom_name=g)
    info[g]={'files':len(files),'tris':len(F),'min':mesh.bounds[0].round(3).tolist(),'max':mesh.bounds[1].round(3).tolist(),'centre':mesh.bounds.mean(0).round(3).tolist()}
    print(g,info[g])
scene.export(sys.argv[2])
print(json.dumps(info,indent=1))
