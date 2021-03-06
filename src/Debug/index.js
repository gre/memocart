//@flow
import React from "react";
import ReactDOM from "react-dom";

let instance;

const editables = {};
const editablesHooks = {};
const logValues = {};
let errorMessage = "";

export const defineEditable = (
  name: string,
  value: mixed,
  onChange?: (value: mixed) => void
) => {
  if (name in editables) return;
  editables[name] = value;
  editablesHooks[name] = [];
  if (onChange) editablesHooks[name].push(onChange);
  if (instance) instance.forceUpdate();
};

export const setEditable = (name: string, value: mixed) => {
  if (value === editables[name]) return;
  editables[name] = value;
  if (instance) instance.forceUpdate();
};

export const getEditable = (name: string) => editables[name];

export const log = (name: string, value: mixed) => {
  if (value === logValues[name]) return;
  logValues[name] = value;
  if (instance) instance.forceUpdate();
};

// try to run a function, if it throws an exception, all console.logs will get displayed, if there is none, just the error.
export const tryFunction = (f: Function) => {
  let logs = [];
  const oldConsoleLog = console.log;
  //$FlowFixMe
  console.log = (...args) => {
    oldConsoleLog.apply(console, args);
    logs.push(args[0]);
  };
  const oldConsoleWarn = console.warn;
  //$FlowFixMe
  console.warn = (...args) => {
    oldConsoleWarn.apply(console, args);
    logs.push(args[0]);
  };
  const oldConsoleError = console.error;
  //$FlowFixMe
  console.error = (...args) => {
    oldConsoleError.apply(console, args);
    logs.push(args[0]);
  };
  try {
    f();
  } catch (e) {
    logs.push(e.toString());
  }
  //$FlowFixMe
  console.log = oldConsoleLog;
  //$FlowFixMe
  console.warn = oldConsoleWarn;
  //$FlowFixMe
  console.error = oldConsoleError;
  const newErrorMessage = logs.join("\n\n").replace(/%c/g, ""); //HACK
  if (errorMessage !== newErrorMessage) {
    errorMessage = newErrorMessage;
    if (instance) instance.forceUpdate();
  }
};

if (process.env.NODE_ENV !== "production" && !("ontouchstart" in document)) {
  class EditNumber extends React.Component {
    onChange = e => {
      if (isNaN(e.target.value)) return;
      this.props.onChange(parseFloat(e.target.value));
    };
    render() {
      const { value } = this.props;
      return (
        <input value={value} type="number" step={1} onChange={this.onChange} />
      );
    }
  }
  class EditBool extends React.Component {
    onChange = e => {
      this.props.onChange(e.target.checked);
    };
    render() {
      const { defaultValue } = this.props;
      return (
        <input
          defaultValue={defaultValue}
          type="checkbox"
          onChange={this.onChange}
        />
      );
    }
  }

  class Debug extends React.Component {
    constructor() {
      super();
      instance = this;
    }
    render() {
      return (
        <div
          style={{
            overflow: "auto",
            height: 100,
            minWidth: 300,
            fontFamily: "monospace",
            padding: 10,
            border: "1px dashed rgba(255,255,255,0.1)"
          }}
        >
          {errorMessage
            ? <pre
                style={{
                  maxWidth: "90vw",
                  overflow: "auto",
                  maxHeight: 300,
                  color: "#f33"
                }}
              >
                <code>
                  {errorMessage}
                </code>
              </pre>
            : null}
          <div>
            {Object.keys(logValues).map(k => {
              const v = logValues[k];
              return (
                <div key={k}>
                  <strong style={{ margin: 5 }}>
                    {k}
                  </strong>
                  <code>
                    {typeof v === "number"
                      ? Math.floor(v * 1000) / 1000
                      : String(v)}
                  </code>
                </div>
              );
            })}
          </div>
          <div>
            {Object.keys(editables).map(k => {
              const v = editables[k];
              const onChange = v => {
                editables[k] = v;
                editablesHooks[k].forEach(f => f(v));
              };
              return (
                <div
                  key={k}
                  style={{
                    flexDirection: "row",
                    display: "flex"
                  }}
                >
                  <strong style={{ margin: 5 }}>
                    {k}
                  </strong>
                  {typeof v === "number"
                    ? <EditNumber value={v} onChange={onChange} />
                    : typeof v === "boolean"
                      ? <EditBool value={v} onChange={onChange} />
                      : v instanceof Array && typeof v[0] === "number"
                        ? v.map((v, i) => {
                            const onChangeItem = v => {
                              const clone = [...editables[k]];
                              clone[i] = v;
                              onChange(clone);
                            };
                            return (
                              <EditNumber
                                key={i}
                                value={v}
                                onChange={onChangeItem}
                              />
                            );
                          })
                        : null}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  }
  const $debug = document.createElement("div");
  if (document.body) {
    document.body.appendChild($debug);
  }
  ReactDOM.render(<Debug />, $debug);
}
