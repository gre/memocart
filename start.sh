
trap 'kill $tlpid; exit' SIGINT
mkdir -p timelapse
cd timelapse
timelapse 30 &
tlpid=$!
cd ..
react-scripts start
