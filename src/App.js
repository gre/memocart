//@flow
import querystring from "querystring";
import React, { Component } from "react";
import Game from "./Game";
import Logo from "./Game/Logo";
import Footer from "./Game/Footer";
import "./App.css";

function inIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

class App extends Component {
  render() {
    const { search } = window.location;
    const query = querystring.parse(search && search.slice(1));
    const hideExtra = "ontouchstart" in document || inIframe();
    return (
      <div className="app">
        {hideExtra ? null : <Logo />}
        <Game query={query} />
        {hideExtra ? null : <Footer />}
      </div>
    );
  }
}

export default App;
