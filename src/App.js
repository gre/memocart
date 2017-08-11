//@flow
import querystring from "querystring";
import React, { Component } from "react";
import Game from "./Game";
import "./App.css";

class App extends Component {
  render() {
    const { search } = window.location;
    const query = querystring.parse(search && search.slice(1));
    const lowQuality = Object.keys(query).some(
      k => k.slice(0, 3).toLowerCase() === "low"
    );
    return (
      <div className="app">
        <Game lowQuality={lowQuality} />
      </div>
    );
  }
}

export default App;
