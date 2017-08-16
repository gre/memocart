import React, { Component } from "react";
import "./Footer.css";

export default class Footer extends Component {
  render() {
    return (
      <div className="footer">
        a game by{" "}
        <a
          rel="noopener noreferrer"
          target="_blank"
          href="https://twitter.com/greweb"
        >
          @GREWEB
        </a>{" "}
        for{" "}
        <a
          rel="noopener noreferrer"
          target="_blank"
          href="https://greweb.itch.io/memocart"
        >
          lowrezjam2017
        </a>{" "}
        – code on {" "}
        <a
          rel="noopener noreferrer"
          target="_blank"
          href="https://github.com/gre/lowrezjam2017"
        >
          github
        </a>
      </div>
    );
  }
}
