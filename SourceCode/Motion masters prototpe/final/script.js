const video = document.getElementById("video");
const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status");

let poseResults = null;
let handResults = null;


function isFingerUp(hand, tip, pip) {
  return hand[tip].y < hand[pip].y;
}


function isThumbsUp(hand) {
  const thumbUp = hand[4].y < hand[2].y;
  const otherFingersDown = hand[8].y > hand[6].y &&
                           hand[12].y > hand[10].y &&
                           hand[16].y > hand[14].y &&
                           hand[20].y > hand[18].y;
  return thumbUp && otherFingersDown;
}

function isThumbsDown(hand) {
  const thumbDown = hand[4].y > hand[2].y;
  const otherFingersDown = hand[8].y > hand[6].y &&
                           hand[12].y > hand[10].y &&
                           hand[16].y > hand[14].y &&
                           hand[20].y > hand[18].y;
  return thumbDown && otherFingersDown;
}


function isTouchingHead(poseLandmarks) {
  const nose = poseLandmarks[0];
  const leftWrist = poseLandmarks[15];
  const rightWrist = poseLandmarks[16];

  const distance = (a,b) => Math.hypot(a.x - b.x, a.y - b.y);
  return distance(leftWrist, nose) < 0.1 || distance(rightWrist, nose) < 0.1;
}


function getFlippedVideoFrame() {
  const offscreen = document.createElement("canvas");
  offscreen.width = video.videoWidth;
  offscreen.height = video.videoHeight;
  const offCtx = offscreen.getContext("2d");
  offCtx.scale(-1, 1); 
  offCtx.drawImage(video, -video.videoWidth, 0, video.videoWidth, video.videoHeight);
  return offscreen;
}


const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});
pose.setOptions({ modelComplexity:1, minDetectionConfidence:0.6, minTrackingConfidence:0.6 });
pose.onResults(results => poseResults = results);


const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({ maxNumHands:2, minDetectionConfidence:0.6, minTrackingConfidence:0.6 });
hands.onResults(results => handResults = results);

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  let detected = "Waiting...";

  if(poseResults?.image){
    ctx.drawImage(poseResults.image,0,0,canvas.width,canvas.height);
    if(poseResults.poseLandmarks){
      const lm = poseResults.poseLandmarks;
      drawConnectors(ctx,lm,POSE_CONNECTIONS,{color:"white"});
      drawLandmarks(ctx,lm,{color:"cyan"});

      const leftWristY = lm[15].y;
      const leftShoulderY = lm[12].y;
      const rightWristY = lm[16].y;
      const rightShoulderY = lm[13].y;
      if(leftWristY < leftShoulderY) detected = "Left Arm Raised";
      if(rightWristY < rightShoulderY) detected = "Right Arm Raised";

      if(isTouchingHead(lm)) detected = "Touching Head";
    }
  }

  if(handResults?.multiHandLandmarks?.length > 0){
    for(const hand of handResults.multiHandLandmarks){
      drawConnectors(ctx, hand, HAND_CONNECTIONS, {color:"white"});
      drawLandmarks(ctx, hand, {color:"yellow"});

      if(isThumbsUp(hand)) { detected = "Thumbs Up 👍"; break; }
      if(isThumbsDown(hand)) { detected = "Thumbs Down 👎"; break; }
    }
  }

  statusText.innerText = detected;
  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);


let cameraStarted = false;
let frameCount = 0;

const camera = new Camera(video,{
  width:480, 
  height:360,
  onFrame: async ()=>{
    if(!cameraStarted) return;

    await pose.send({image:video});

    frameCount++;
    if(frameCount % 2 === 0){
      try {
        const flipped = getFlippedVideoFrame();
        await hands.send({image:flipped});
      } catch(err){
        console.warn("Hands frame skipped:",err);
      }
    }
  }
});

camera.start().then(()=>{cameraStarted=true; statusText.innerText="Camera started!";});
