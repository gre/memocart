# The Cube – LudumDare39

This is a game made in 48 hours in the LudumDare gamejam.

- [LD entry](https://ldjam.com/events/ludum-dare/39/the-cube)
- [COMPO version](https://gre-ld39.surge.sh/) of the game (original version made alone in 48 hours) (frozen source code is in `compo` branch)
- [LATEST version](https://the-cube.surge.sh/) of the game (out of competition)

## quick postmortem

That was some fun 48 hours, i'm satisfied by the actual game logic and mechanism implemented, however i'm disappointed by my graphics state, I expected to implement WAY MORE VISUALS so the game teach your more about things going on... because of this lack of good graphics, the game is probably not straightforward and confusing at the moment. I might try to fix that by experimenting some more Signed Distance Functions – I see potential of stunning effects.

I probably should have dropped some game features in favor of doing more graphics. it's always tricky to prioritize things. If I had started with graphics first, I probably would have not a game but just a demo 3D scene 🤣.

This was a teaching experience and I'm probably going to re-use some technical paradigm for entering the incoming http://js13kgames.com/.

## Technical innovation

source code: https://github.com/gre/ld39/tree/master/src/Game

### FP style: one immutable game state + transition functions <> many renderers

Inspiring from general experience around FP and libraries like Redux I've made that my game is ruled by a big object, the game state, that never gets mutated but only can be given to a bunch of *GameLogic* functions to get a new game state.

I have basically a `create() => GameState` function that inits my game state, and a `tick(GameState) => GameState` that iterates one step of the game (this is called every 500ms). There is also a bunch of `(GameState, ...args) => GameState` functions that are called on some user interactions.

The root component can easily render the game by giving the whole GameState object and a `action` function that is basically  `(fnName, ...args) => this.setState({ game: GameLogic[fnName](this.state.game, ...args) })`.

This was very useful as I quickly made a RenderDebug component that was rendering the game. when I started implementing the actual Render, I was able to do a side-by-side rendering of the full game which was extremly useful to detect rendering bugs:

![](https://user-images.githubusercontent.com/211411/28778171-804df64c-75fe-11e7-8df1-a99640ea1d6b.png)

there is a shared UI that is rendered in DOM. otherwise on left is the WebGL rendering, on right is the debug SVG rendering.

Finally, as there is **absolutely no state** in my render components, I was able to have **hot reload** of my rendering, which is very useful: the game is still running while you tweak the UI. I'm sure you could do the same hot reload for the transition functions (I didn't tried that because I was fine assuming state needs to reload for logic changes).

```js
let { default: RenderDebug } = require("./RenderDebug");
let { default: Render } = require("./Render");
let { default: UI } = require("./UI");
if (module.hot) {
  module.hot.accept("./RenderDebug", () => {
    RenderDebug = require("./RenderDebug").default;
  });
  module.hot.accept("./Render", () => {
    Render = require("./Render").default;
  });
  module.hot.accept("./UI", () => {
    UI = require("./UI").default;
  });
}
```

I also figured out GLSL shaders hot reload!

```js
if (module.hot) {
  module.hot.accept("./shaders/render", () => {
    render = require("./shaders/render")(regl);
  });
}
```

There is one thing that I missed to add in the current game: an interpolation between 2 game states. Because the game runs at 2 tick per second, the current animation sucks but I'm thinking it would be easy to add linear interpolation that is just like `lerp(gameState, tick(gameState), percentToNextTick)`.

### Signed Distance Functions (aka raymarching a distance func)

I wanted to give a try to this rendering paradigm. It involves [raymarching](http://iquilezles.org/www/articles/raymarchingdf/raymarchingdf.htm) a `(vec3 position) => distance` function that estimates the distance to the closest 3D Object for a given point in space. It's a mindblowing paradigm (to me it's kinda as mindblowing as the [`vec2=>color`](http://greweb.me/2013/11/functional-rendering/) fragment shader paradigm).
I found this paradigm very powerful to express complex shapes but also quite difficult to have good performance (always tweaking the raymarch parameters).

**playground**

I started my experiment with doing a plane and repeating torus on it. then it was very easy to iterate and compose this repeating torus into a room with walls:


<img width="433" alt="screen shot 2017-07-27 at 19 33 36" src="https://user-images.githubusercontent.com/211411/28777459-891e1674-75fb-11e7-94f9-dd78184f980c.png">

I've also made a "toon" lighting effect: the black line on edge of the 3D objects is performed by simply rendering black when `dot(normal, direction) < 0.2` (quick way I figured out to do it, tho [it does not work great when you have planes](https://user-images.githubusercontent.com/211411/28782549-c0afb3ba-760d-11e7-98a5-7ff5b3966128.png) so I opt-out my planes to have this effect). I also played with a stepping on the lighting diffuse value to have some "rough lines" in the rendered lighting (tried various thing around `diffuse = floor(diffuse*N)/N`).

Finally, I had fun doing some `smin` (smooth min) that allows to do smooth union, see how the edge nicely join, as well at the torus with the plane:

<img width="502" alt="screen shot 2017-07-28 at 11 48 54" src="https://user-images.githubusercontent.com/211411/28777491-a6cfc442-75fb-11e7-966c-824ad80692f1.png">


**bad estimation glitches**

I also found that getting a good estimation function is somewhat challenging. For instance, the [`opRep` operation](http://iquilezles.org/www/articles/distfunctions/distfunctions.htm) seems to generate bad result on edges, like if you repeat cells and one of your cell is a cube that touch edges. because basically a cell is not aware of its neighbor models, I wonder if you need to also `opU` at least the direct neighbor cell? (performance VS quality tradeoff)

**an utility to visualize the distance on a plane**

I also wrote my custom way to display (inspired from this talk: https://www.youtube.com/watch?v=s8nFqwOho-s):

you can see the problem that `opRep` is creating: the fact i have non smooth curve (tho I don't know why my lines are breaking, probably the raymarch quality)

<img width="400" src=https://user-images.githubusercontent.com/211411/28782642-0b449224-760e-11e7-944b-b445ba04053b.png />

(see it in action https://www.youtube.com/watch?v=Nsc1oPUaCxM – I have XBox360 controller support for debugging too😇)

**wrong attempt to do a terrain created crazy glitch**

<img src="https://user-images.githubusercontent.com/211411/28782512-9e5970f8-760d-11e7-8bcb-7caa289824cc.png">

---

More on raymarching: http://xem.github.io/articles/#webgl_quest_2
