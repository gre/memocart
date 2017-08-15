## high pri

- AUDIO
  - bootstrap
  - can hear the train pace in background. only louder when it's slower so it's not annoying.
  - braking creates the crazy brake sound of train.
  - gameover. hitting the rocks hard need to have sound.
  - the ending. no more train pace, maybe a zen sound.
  - music or maybe ambient sound. i'm thinking one ambient per biome too, but an overall theme?

- UFO is not a biome. should be a recurrent event at specific level. so we can develop the "story" per level.
- room for 2 biomes. but what?
  - a biome with walls but no roof/floor (what more to do in this biome? woods?)
  - playing with room size amplitude?
  - i wished for more shaped, like stalactite, but i don't think can afford the gpu cost
- develop the end story. something should happen with the animated ball. probably should just use another shader :D
- play the game FOR REAL to see if there are gameplay to improve in level gen (intersect / etc..)

# medium

- idea: walls might be smoother with rounded corners, maybe if we remove a constant value to the distance?
- light object on the front left section of the cart : diff of 2 sphere
- bug: the flame map is not properly mapped, see in low Q.
- the gameover animation needs to touch the cart and then slightly go back. can play with trackStepProgress i guess
- various rocks. if we can figure out generative unique shapes, it's good for "remembering" position.
- more biomes, more objects that are uniquely positioned.
  - B_WATER
  - B_ROCKY: where there is no wall but you ride on a thin rock. I think the oversee vision can be cool (less fog. any room to INCREASE TRACK_SIZE?)
- end story? might be important, but not too crazy (there is no room for perf...). thinking maybe it becomes blueish and you enter in a nice landscape...
- lighting. maybe we can do something a tiny bit better if we add specular to some material (like the cart?) https://en.wikipedia.org/wiki/Phong_reflection_model

# credits

- https://www.ruxtons.com/images/IG1202-3.jpg
- https://www.youtube.com/watch?v=4ds9mfUB7Dg
- https://itch.io/jam/lowrezjam2016/topic/19302/minimal-pixel-font
- http://mercury.sexy/hg_sdf/
- http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
