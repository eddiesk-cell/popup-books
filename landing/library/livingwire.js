// livingwire.js: the living shelves (living.js, lane L3c) wired the way renders/landing/L3c/WIRING.md says, in one place so library.js adds three lines:
//   const living = wireLiving(THREE, { scene, camera, room, fx: sfx, reduced, phone });      after the storyfx exists (sfx lifts its page clip and top-quarter fade itself in library.js)
//   each frame: living.update(dt);   on arriving at a station: living.setStation(id);   on a tap that is not a drag: if (living.tap(ndcX, ndcY)) return;
import { createLiving, STATION_KINDS } from "./living.js";
export function wireLiving(THREE, { scene, camera, room, fx, reduced, phone, onTap }) {
  const kindOf = id => id === "home" ? "home" : /^(east|west)$/.test(id) || /#[1-4]$/.test(id) || /^r:/.test(id) ? "mid" : "far";  // home shows its own set; the first rooms another; the far ones the rest
  const living = createLiving(scene, camera, { spots: (room.livingSpots ?? []).map(s => ({ ...s, width: s.book?.w ?? .06, height: s.book?.h, color: s.spine?.color ? (s.spine.color[0] << 16) | (s.spine.color[1] << 8) | s.spine.color[2] : undefined, bands: s.spine?.goldBand ? 2 : 0 })), fx, reduced, phone, station: "home", onTap });
  return { update: dt => living.update(dt), setStation: id => living.setStation?.(kindOf(id)), tap: (x, y) => living.tap(x, y), living, kinds: STATION_KINDS };
}
