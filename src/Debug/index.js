import React from "react";
import ReactDOM from "react-dom";

let instance;

const editables = {};
const editablesHooks = {};
const logValues = {};

export const defineEditable = (name, value, onChange) => {
  editables[name] = value;
  editablesHooks[name] = [];
  if (onChange) editablesHooks[name].push(onChange);
  if (instance) instance.forceUpdate();
};

export const setEditable = (name, value) => {
  if (value === editables[name]) return;
  editables[name] = value;
  if (instance) instance.forceUpdate();
};

export const getEditable = name => editables[name];

export const log = (name, value) => {
  if (value === logValues[name]) return;
  logValues[name] = value;
  if (instance) instance.forceUpdate();
};

if (process.env.NODE_ENV !== "production") {
  class EditNumber extends React.Component {
    onChange = e => {
      if (isNaN(e.target.value)) return;
      this.props.onChange(parseFloat(e.target.value, 10));
    };
    render() {
      const { defaultValue } = this.props;
      return (
        <input
          defaultValue={defaultValue}
          type="number"
          step={0.1}
          onChange={this.onChange}
        />
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
            fontFamily: "monospace",
            padding: 10,
            border: "1px dashed rgba(255,255,255,0.1)"
          }}
        >
          <div>
            {Object.keys(logValues).map(k => {
              const v = logValues[k];
              return (
                <div key={k}>
                  <strong style={{ margin: 5 }}>
                    {k}
                  </strong>
                  <code>
                    {typeof v === "number" ? Math.floor(v * 1000) / 1000 : v}
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
                    ? <EditNumber defaultValue={v} onChange={onChange} />
                    : typeof v === "boolean"
                      ? <EditBool defaultValue={v} onChange={onChange} />
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
                                defaultValue={v}
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
  document.body.appendChild($debug);
  ReactDOM.render(<Debug />, $debug);
}
