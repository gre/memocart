//@flow
import querystring from "querystring";
import React, { Component } from "react";
import Game from "./Game";
import Logo from "./Game/Logo";
import Footer from "./Game/Footer";
import "./App.css";

const acceptQuality = q =>
  q === "high" || q === "medium" || q === "low" ? q : null;

class App extends Component {
  render() {
    const { search } = window.location;
    const query = querystring.parse(search && search.slice(1));
    const isMobile = "ontouchstart" in document;
    return (
      <div className="app">
        {isMobile ? null : <Logo />}
        <Game quality={acceptQuality(query.quality)} />
        {isMobile ? null : <Footer />}
      </div>
    );
  }
}

export default App;
