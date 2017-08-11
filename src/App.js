//@flow
import querystring from "querystring";
import React, { Component } from "react";
import Game from "./Game";
import "./App.css";

class App extends Component {
  render() {
    const { search } = window.location;
    const query = querystring.parse(search && search.slice(1));
    return (
      <div className="app">
        <Game lowQuality={"lowQuality" in query} />
      </div>
    );
  }
}

export default App;
