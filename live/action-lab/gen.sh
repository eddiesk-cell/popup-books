#!/bin/bash
# Kimodo fight clips for the action lab, one GPU job at a time (desk: kimodo.cpp lives there). Skips finished clips; a 5th column overrides the seed.
#   web/live/action-lab/gen.sh [name ...]      out: renders/review/action-slices-v2/kimodo/<name>/motion.bvh
cd "$(dirname "$0")"; OUT=../../../renders/review/action-slices-v2/kimodo; K=~/ai-stack/kimodo/kimodo-generate.sh
while IFS=$'\t' read -r n f s p; do
  [ $# -eq 0 ] || [[ " $* " == *" $n "* ]] || continue
  [ -f "$OUT/$n/motion.bvh" ] && continue
  echo "== $n"; "$K" "$p" "$OUT/$n" "$f" 100 "$s" > "$OUT/$n.log" 2>&1 < /dev/null || echo "FAILED $n"
done < fight-clips.tsv
echo gen-done
