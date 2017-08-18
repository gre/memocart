# LOWREZJAM2017 idea – greweb

This was written on August 3th. First pitch of the game.

## inspiration / tech

- http://js1k.com/2013-spring/demo/1555
- WebGL & Signed Distance Functions

## pitch

This is a "path memory" game. You drive a mine wagon than make left or right turn over a series of intersections in a mysterious abandoned mine.
One of the path is correct, one is incorrect. When you take the wrong turn, you lose (dead end), the game start over and you have to remember which is the right path to progress more intersections. You can't observe which is the right turn at first, only way is to try it.

## game design brainstorm

- the control is simple, you can just change the wagon switch left OR right.
- there is one intersection each 5~10s. this is not constant, maybe sometimes there is shorter or longer phases.
- I'm thinking about levels (first play is easy, just 2-3 intersections). A level defines the number of intersections there is in total. After a win, you start over. Maybe the same map could be used but we just would **prepend** N more intersections each level up? that way, you would always remember the end part, except it can be kinda annoying right? kinda good as game is about **memory**. WDYT?
- probably everything should be procedurally generated, probably seeded. That way, the game is never the same.

### game graphics brainstorm

You are inside a mine. There need to be diversity in visuals to identify where you are. there needs to be different "biomes" to generate a unique experience.

- Moreover, **the track can go more or less left/right** (kinda randomly) **and more or less up/down** (the slope/descent varies and will drive your wagon speed that follows gravity). *(btw technically the end, the game is just 1-dimensional somehow. there is just many data on each point. like the slope, the turn, the biome, etc.. raymarching that might be simple? for intersection, need to think more about them, maybe it's a special case)*
- When you reach the level end, I think basically you find the "exit" and we need nice visual. It could JUST go crazily light (you are dazzled with the lighting). A more advanced idea to add is that you actually a fall into waterfall or a lake (like in these old Movies, any movie reference plz!?). Finally, I think higher the level is, more epic this end is, like it stays longer and you discover more and more things about the "general" story (where you ends up at the end). that way, you want to play more and more.
- see your **wagon**, maybe kinda statically like https://nothke.itch.io/normans-sky
- see the **switch on the wagon** (to see if it's set left or right)
- **rails** (obviously)
- **stalactite / stalagmite**
- Lightning: at least there is one light on the track, but maybe there could be lights on some Biomes?
- Biome: a big room
- (low) Biome: some river / water-ish
- Biome: insects like firefly
- Biome: bats
- (low) variety in dead ends. could be a wall, or you fall, or fire,...

### game sound brainstorm

- the track sound I guess? it could be a bit annoying tho. but it can be good when wagon accelerate/decelerate.
- ambient music. maybe a weird / scary one? (like using some oscillator / FM :D)
- I kinda like this music maybe could "fork" the idea^^ https://www.youtube.com/watch?v=Pq9Eqbygj8g – basically i kinda like the part where the music goes stronger than the train sound and then sometimes you hear train sound again, etc.. could be in sync with the different biomes.
