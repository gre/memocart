
timelapseInterval=30
trap 'kill $tlpid; exit' SIGINT
mkdir -p timelapse
hours=$(bc -l <<< "scale=1;`ls -l timelapse | wc -l` / (3600/$timelapseInterval)")
echo "${hours} hours of timelapse!"
cd timelapse
timelapse 30 &
tlpid=$!
cd ..
react-scripts start
