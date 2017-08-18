set -e

mkdir -p snapshots-copy
cd timelapse
count=0
for f in *.jpg ; do
  printf -v counts "%06d" $count
  out=../snapshots-copy/$counts.jpg
  if [ ! -e "$out" ]; then
    day=${f:0:10}
    time=${f:11:5}
    txt="$day    $time"
    convert $f \
      -font ../src/Game/MinimalPixels.ttf \
      -pointsize 100 \
      -gravity SouthWest \
      -fill '#000' -annotate +24+14 "$txt" \
      -fill '#000' -annotate +16+6 "$txt" \
      -fill '#000' -annotate +24+6 "$txt" \
      -fill '#000' -annotate +16+14 "$txt" \
      -fill '#fff' -annotate +20+10 "$txt" \
      $out
  fi
  count=`expr $count + 1`
done
