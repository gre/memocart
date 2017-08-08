## Main TODO
- iterate on biomes
- iterate levels
- more variety in the turn/descent.
- add basic level 0 help, texts.. (level 0=teaching level (skippable tutorial), maybe could even pause to explain things)
- quick audio bootstrap

- fix the damn camera <- is it ok now?

## Name idea

MEMO TRAIN
MEMO CART

## Game
- bootstrap GameState Logic
- implement basic working game idea for a level: series of intersection and an end.
- implement the "next level" logic
- make you should be able to look around? up down, left right. gamepad support.

## Graphics
- implement the intersection. for simplicity intersection probably will be in wall-less rooms so we can do a union without having bugs.. tho it's going to be tricky to keep the current paradigm. we also need to think how derivation happen, i'm thinking maybe just mirroring the direction for now.. the gen need to make sure it's a strong turn. maybe it's ok to suddenly enter in an empty room (no more walls), but need to think more about visuals to add.
- implement the (basic) end. very lightish for now. (need to work on the "story" later)
- for intersection biome, maybe before going in empty room, we need to have some wood holding the walls.
- polish Rail: a real rail is a bit darker, fit that?
- under the rail, there should be rocks & a bit everywhere on the ground
- think lighting?
- more complex wall shape https://www.shadertoy.com/view/Xsd3Rs
- improve cart details https://www.ruxtons.com/images/IG1202-3.jpg
- seamless perlin noise plz :D
- all randomness should be seeded. including perlin noise.

## Biome/variety ideas

- ambients color
- walls could be "painted". we could have a specific texture that we re-set each chunk gen time that is just drawn on walls? Cube Mapping.
- probably inject a perlin noise texture too? we can avoid doing too complex noise code.
- various visual effect on colors. I'm thinking there could be very dark rooms vs very light. (also imagine crazy room where weird glitch happen, what does it mean for the story tho xD) (we need lighter biome when we reach the end)
- insects? https://www.shadertoy.com/view/Mss3zM
- firefly is interesting (what about lighting? :o)
- rocks & various objects
- soom wood holding the roof.
- some clothes https://www.shadertoy.com/view/ldlcRf
- stalac(t/m)ite.
- plants / ivy
- mushrooms
- water/lava? https://www.shadertoy.com/view/llK3Dy
- flame/fire https://www.shadertoy.com/results?query=fire ( https://www.shadertoy.com/view/MdX3zr / https://www.shadertoy.com/view/MsSBD1 / https://www.shadertoy.com/view/4dXGR4 )
- weird shapes https://www.shadertoy.com/view/MsfGzM , https://www.shadertoy.com/view/4ts3z2

## Audio

- bootstrap
- can hear the train pace in background. only louder when it's slower so it's not annoying.
- braking creates the crazy brake sound of train.
- gameover. hitting the rocks hard need to have sound.
- the ending. no more train pace, maybe a zen sound.
- then needs music.


# perf

- can we not do the tracks for loop? kinda tricky but basically can we use mod() ? mmh
- are shadows/AO feasible? XD http://advances.realtimerendering.com/s2015/DynamicOcclusionWithSignedDistanceFields.pdf



# credits

https://itch.io/jam/lowrezjam2016/topic/19302/minimal-pixel-font
