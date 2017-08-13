import React, { Component } from "react";
import "./Footer.css";

export default class Footer extends Component {
  render() {
    return (
      <div className="footer">
        a game by{" "}
        <a target="_blank" href="https://twitter.com/greweb">
          @GREWEB
        </a>{" "}
        for{" "}
        <a target="_blank" href="https://itch.io/jam/lowrezjam2017">
          lowrezjam2017
        </a>{" "}
        – code on {" "}
        <a target="_blank" href="https://github.com/gre/lowrezjam2017">
          github
        </a>
      </div>
    );
  }
}
