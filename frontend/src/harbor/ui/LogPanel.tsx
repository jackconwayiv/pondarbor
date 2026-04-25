import type { HarborState } from "../engine/types";

type Props = {
  state: HarborState;
};

export default function LogPanel({ state }: Props) {
  if (state.log.length === 0) return null;
  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Harbor Log</span>
        <span className="harbor-panel__hint">most recent first</span>
      </div>
      <ul className="harbor-log">
        {state.log.slice(0, 50).map((entry, i) => (
          <li
            key={i}
            className={`harbor-log__item harbor-log__item--${entry.kind}`}
          >
            <span className="harbor-log__day">d{entry.day}</span>
            {entry.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
