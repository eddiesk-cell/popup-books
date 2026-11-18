"""Fight clips for the action lab: Kimodo clips (fight-clips.tsv, made by gen.sh) put on a rigged character, with root motion kept where the
move travels, the body turned to face the front, the lowest skinned point on the floor whenever it is not in the air, and checks.

  Blender -b -P web/live/action-lab/bake_fight.py -- <retarget.py> <char.glb> <clips dir> <out.glb> [--hand-from-forearm] <move>[=<clip>][:place|root|rootend] ...

  place    stays on the spot: heading and hip drift taken out, the move's own sway, twist and bob kept (stances, swings, reactions)
  root     travels: the whole clip turned so its first frame faces the front, its travel kept (sideways drift taken out); the page places it
  rootend  as root, but turned so its LAST frame faces the front (a get-up must end facing the foe)

The transfer is ~/ai-stack/kimodo/retarget/retarget.py's own (its middle section is exec'd, as assets/kapi/dance/bake_dance.py does, so there is
one copy of that maths). Writes <out.glb> (skeleton and clips only: the page plays them on the character's own file) and <out>.checks.json:
feet under the floor, a planted foot's slide, wrists flipped, hands and forearms inside the body. Sheets are drawn by the page itself
(lab.js ?sheet=), so they show the staff in the hand and the horns as the slices do.
"""
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion

a = sys.argv[sys.argv.index("--") + 1:]
RT, GLB, CLIPS, OUT = a[:4]
MOVES, FOREARM = [], "--hand-from-forearm" in a  # a rig whose finger bones do not run along the hand (Kapi's point forward): the hand keeps its rest angle to the forearm
for x in [x for x in a[4:] if not x.startswith("--")]:
    x, mode = (x.split(":") + ["place"])[:2]; name, clip = (x.split("=") + [x])[:2]; MOVES.append((name, clip, mode))
os.environ["KIMODO_ADDUCT"] = "0"  # fighters' arms as Kimodo made them
text = open(RT).read()
head = text[text.index("BONE_MAP = {"):text.index("bpy.ops.wm.read_factory_settings")]
core = text[text.index("# --- rest-pose corrections"):text.index("bpy.data.objects.remove(src")]
core = core.replace('rest_src_hip = (src.matrix_world @ src.pose.bones["Hips"].matrix).translation.copy()', 'rest_src_hip = (src.matrix_world @ src.pose.bones["Hips"].matrix).translation.copy(); rest_src_hip.z = 0.995')  # a clip may start crouched or lying: scale by a standing hip
core = core.replace("import math as _m", "for _n in ('neck', 'head'): byname[_n][3] = Matrix.Identity(3)\nimport math as _m", 1)
if FOREARM: core = core.replace("EXTRA = {", "EXTRA = {} if True else {", 1)
assert "rest_src_hip.z = 0.995" in core and (not FOREARM or "EXTRA = {} if True" in core) and "byname[_n][3]" in core, "retarget.py changed: the patch anchors are gone"
env = {"bpy": bpy, "sys": sys, "os": os, "Vector": Vector}
exec("from mathutils import Vector\nimport os\n" + head, env)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
tgt = next(o for o in bpy.data.objects if o.type == "ARMATURE"); env["tgt"] = tgt
mesh = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
for x in list(bpy.data.actions): bpy.data.actions.remove(x)
tgt.animation_data_create()
B, PB, SC = tgt.data.bones, tgt.pose.bones, bpy.context.scene
MW = np.array(mesh.matrix_world)
vg = {g.index: g.name for g in mesh.vertex_groups}
dom = [vg[max((g.weight, g.group) for g in v.groups)[1]] if v.groups else "" for v in mesh.data.vertices]
FORE = {s: np.array([i for i, n in enumerate(dom) if n.startswith(s) and any(k in n for k in ("LowerArm", "Hand", "Thumb", "Index", "Middle", "Ring", "Little"))])[::6] for s in ("left", "right")}
SOLE = {s: np.array([i for i, n in enumerate(dom) if n in (f"{s}Foot", f"{s}Toes")]) for s in ("left", "right")}


def verts():
    ev = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()); me = ev.to_mesh(); v = np.empty(len(me.vertices) * 3, "f4"); me.vertices.foreach_get("co", v)
    ev.to_mesh_clear(); return v.reshape(-1, 3) @ MW[:3, :3].T + MW[:3, 3]


def W(n): return tgt.matrix_world @ PB[n].head


def yaw_now(): v = W("leftUpperLeg") - W("rightUpperLeg"); return math.atan2(v.y, v.x)


for p in PB: p.matrix_basis = Matrix.Identity(4)
SC.frame_set(0); bpy.context.view_layer.update()
V0 = verts(); FLOOR = float(V0[:, 2].min()); H = float(V0[:, 2].max()) - FLOOR; YAW0 = yaw_now(); REST_HIP = PB["hips"].head.copy()
AIR = 0.012 * H
print(f"BODY {os.path.basename(GLB)} height {H:.3f}, floor {FLOOR:.4f}, heading {math.degrees(YAW0):.1f} deg")
CAPS = [("hips", "spine"), ("spine", "chest"), ("chest", "upperChest"), ("upperChest", "neck"), ("neck", "head"), ("head", "HeadTop_End"),
        ("leftUpperLeg", "leftLowerLeg"), ("leftLowerLeg", "leftFoot"), ("rightUpperLeg", "rightLowerLeg"), ("rightLowerLeg", "rightFoot")]


def seg_d(P, a_, b_): ab = b_ - a_; t = np.clip(((P - a_) @ ab) / (ab @ ab), 0, 1); return np.linalg.norm(P - (a_ + t[:, None] * ab), axis=1)


RAD = []
for c in CAPS:  # a capsule's radius: the 35th percentile of its own skin's distance from the bone (a bone that owns no skin: 3% of the height)
    own = [i for i, n in enumerate(dom) if n == c[0]]; RAD.append(float(np.percentile(seg_d(V0[own], np.array(W(c[0])), np.array(W(c[1]))), 35)) if own else 0.03 * H)


def depth_in(P): return np.max([r - seg_d(P, np.array(W(a_)), np.array(W(b_))) for (a_, b_), r in zip(CAPS, RAD)], axis=0)


assert depth_in(np.array([W("chest"), W("hips")])).min() > 0 and depth_in(np.array([W("chest") + Vector((0, 0, 2 * H))]))[0] < 0, "inside test cannot tell inside from outside"


def set_hips(rot_z, xy):  # turn the hips about the vertical through themselves by rot_z, then put them at xy (armature space)
    m = PB["hips"].matrix.copy(); r = (Matrix.Rotation(rot_z, 3, "Z") @ m.to_3x3()).to_4x4(); r.translation = Vector((xy[0], xy[1], m.translation.z)); PB["hips"].matrix = r
    bpy.context.view_layer.update()


def linfit(y): t = np.arange(len(y)); return np.polyval(np.polyfit(t, y, 1), t)


report = {}
for name, clip, mode in MOVES:
    before = set(bpy.data.objects)
    bpy.ops.import_anim.bvh(filepath=os.path.join(CLIPS, clip, "motion.bvh"), global_scale=0.01, use_fps_scale=False, update_scene_fps=True, update_scene_duration=True)
    src = next(o for o in bpy.data.objects if o not in before and o.type == "ARMATURE")
    env.update(src=src, hips_track=None)
    for p in PB: p.matrix_basis = Matrix.Identity(4)
    exec(core, env)
    act = tgt.animation_data.action; act.name = name; f0, f1 = env["f0"], env["f1"]
    bpy.data.objects.remove(src, do_unlink=True)
    yaw, hxy = [], []
    for f in range(f0, f1 + 1): SC.frame_set(f); yaw.append(yaw_now()); hxy.append(np.array(PB["hips"].matrix.translation.xy))
    yaw = np.unwrap(np.array(yaw)); hxy = np.array(hxy)
    if mode == "place":
        want = YAW0 + np.clip(yaw - linfit(yaw), -0.5, 0.5); xy = np.array(REST_HIP.xy) + hxy - np.stack([linfit(hxy[:, 0]), linfit(hxy[:, 1])], 1)
    else:
        c = YAW0 - (yaw[0] if mode == "root" else yaw[-1]); want = yaw + c; R = np.array([[math.cos(c), -math.sin(c)], [math.sin(c), math.cos(c)]])
        d = (hxy - hxy[0]) @ R.T; fwd = np.array([-math.sin(YAW0), -math.cos(YAW0)]); side = np.array([fwd[1], -fwd[0]])  # facing -Y at heading 0 (glTF +Z forward)
        lat = d @ side; d -= np.outer(linfit(lat) - lat[0], side)  # sideways drift out, sway kept
        xy = np.array(REST_HIP.xy) + d
    for i, f in enumerate(range(f0, f1 + 1)):
        SC.frame_set(f); set_hips(want[i] - yaw[i], xy[i]); PB["hips"].keyframe_insert("rotation_quaternion", frame=f); PB["hips"].keyframe_insert("location", frame=f)
    for f in range(f0, f1 + 1):  # on the floor unless in the air (a leap keeps its height)
        SC.frame_set(f); h = float(verts()[:, 2].min()) - FLOOR; s_ = min(max((h - AIR) / AIR, 0.0), 1.0); dz = -h * (1 - s_ * s_ * (3 - 2 * s_))
        m = PB["hips"].matrix.copy(); m.translation.z += dz; PB["hips"].matrix = m; bpy.context.view_layer.update(); PB["hips"].keyframe_insert("location", frame=f)
    # checks on the final clip
    sink, air, twist, bend, inside, slide, worst, prev = 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, [], {}
    rest = {n: B[n].matrix_local.to_3x3() for n in ("leftLowerArm", "leftHand", "rightLowerArm", "rightHand")}
    for f in range(f0, f1 + 1):
        SC.frame_set(f); V = verts(); h = float(V[:, 2].min()) - FLOOR; sink = min(sink, h); air = max(air, h)
        for s in ("left", "right"):
            fa, ha = PB[f"{s}LowerArm"].matrix.to_3x3(), PB[f"{s}Hand"].matrix.to_3x3()
            q = ((fa @ rest[f"{s}LowerArm"].inverted()).inverted() @ (ha @ rest[f"{s}Hand"].inverted())).to_quaternion()
            ax = (B[f"{s}Hand"].head_local - B[f"{s}LowerArm"].head_local).normalized()
            tw = 2 * math.atan2(Vector(q[1:]).dot(ax), q.w); tw = (tw + math.pi) % (2 * math.pi) - math.pi
            sw = (q @ Quaternion(ax, tw).inverted()).angle; sw = min(sw, 2 * math.pi - sw)
            twist = max(twist, abs(math.degrees(tw))); bend = max(bend, math.degrees(sw))
            dep = float(depth_in(V[FORE[s]]).max())
            if dep > 0.002: inside = max(inside, dep); worst.append((f, s, round(dep / H * 100, 1)))
            so = V[SOLE[s]]; low = float(so[:, 2].min()) - FLOOR; c_ = so[:, :2].mean(0)
            if low < AIR and s in prev and prev[s][0] < AIR: slide = max(slide, float(np.linalg.norm(c_ - prev[s][1])))  # a planted foot's travel in one frame
            prev[s] = (low, c_)
    worst = sorted(worst, key=lambda w: -w[2])[:3]
    ok = sink > -0.002 * H and twist < 100 and bend < 80 and inside < 0.03 * H and slide < 0.012 * H
    report[name] = dict(clip=clip, mode=mode, frames=f1 - f0 + 1, sink_pct=round(sink / H * 100, 2), air_pct=round(air / H * 100, 1), slide_pct_per_frame=round(slide / H * 100, 2),
                        wrist_twist_deg=round(twist, 1), wrist_bend_deg=round(bend, 1), inside_pct=round(inside / H * 100, 1), inside_worst=worst, ok=ok)
    print("CHECK", name, json.dumps(report[name]))
    tr = tgt.animation_data.nla_tracks.new(); tr.name = name; act.use_frame_range = True; act.frame_start, act.frame_end = f0, f1; tr.strips.new(name, f0, act)
    tgt.animation_data.action = None

for o in bpy.data.objects: o.select_set(o == tgt)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_animations=True, export_nla_strips=True, export_force_sampling=True, export_anim_slide_to_zero=True,
                          export_optimize_animation_size=True)
json.dump(dict(fps=30, height=H, moves=report), open(OUT.replace(".glb", ".checks.json"), "w"), indent=1)
print("EXPORTED", OUT, os.path.getsize(OUT), "bytes; all ok:", all(r["ok"] for r in report.values()))
