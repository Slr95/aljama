import "./style.css";
import { subscribe } from "./game/engine.js";
import { render, bind } from "./ui/render.js";

bind();
subscribe(render);
render();
