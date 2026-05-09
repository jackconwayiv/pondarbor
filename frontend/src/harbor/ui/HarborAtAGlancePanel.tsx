/**
 * How to play: merged tutorial + quick reference (formerly separate “At a glance”).
 */

export default function HarborAtAGlancePanel() {
  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">How to Play</span>
      </div>

      <div className="harbor-help-howto" role="tabpanel">
        <section className="harbor-help-howto__block">
          <h3 className="harbor-help-howto__heading">Berths & movement</h3>
          <p className="harbor-help-howto__p">
            Throughput is how many ships may tie up at once. In <strong>Age 1</strong>,
            moving ships between berths, mooring, and the arrivals basin costs no anchors,
            except <strong>berthing a ship that returned laden</strong> from Out to sea
            (one ⚓). From <strong>Age 2</strong> onward, each berth move spends one
            anchor (⚓); what’s left today is on the HUD.
          </p>
        </section>

        <section className="harbor-help-howto__block">
          <h3 className="harbor-help-howto__heading">
            Out to sea (queue + voyages + returned cargo)
          </h3>
          <p className="harbor-help-howto__p">
            This strip shows everything away from the dock: ships queued to sail on the
            next end-day, ships currently on voyage (hourglasses), ships that returned
            laden (labeled <strong>LADEN</strong>), and sometimes a <strong>brand-new
            empty hull</strong> if there was no free berth when it was commissioned — it is
            waiting for you to make room, not on a voyage. Drag a berthed ship here to
            queue a voyage (only when she is alongside). When a run finishes, the ship
            stays in this strip until you <strong>drag it onto a berth</strong>; cargo
            does not bank until the ship has spent <strong>one full day</strong> tied up.
          </p>
          <p className="harbor-help-howto__p">
            To cancel a queued departure, <strong>drag that ship back</strong> onto a
            berth.
          </p>
        </section>

        <section className="harbor-help-howto__block">
          <h3 className="harbor-help-howto__heading">Waiting for a berth</h3>
          <p className="harbor-help-howto__p">
            If your fleet exceeds dock space, extra ships wait here until you sail ships
            out or raise throughput (for example, another pier).
          </p>
        </section>

        <section className="harbor-help-howto__block">
          <h3 className="harbor-help-howto__heading">Incoming</h3>
          <p className="harbor-help-howto__p">
            Ships in the arrivals basin need a berth — drag them to a free slot.
          </p>
        </section>

        <section className="harbor-help-howto__block">
          <h3 className="harbor-help-howto__heading">Quick reference</h3>
          <ul className="harbor-help-howto__ul">
            <li>
              <strong>Berths</strong> — Ships in port are tied up here (or queued for
              sailing). Drag between slots to reorganize.
            </li>
            <li>
              <strong>Out to sea</strong> — Queue, active voyages, returned laden ships, and
              rare new hulls waiting for a berth share one strip. Use the pager if it does
              not fit on one screen.
            </li>
            <li>
              <strong>LADEN</strong> — Ship returned with cargo; berth it (⚓ in Age 1) so
              goods can bank after one full day in berth.
            </li>
          </ul>
        </section>
      </div>
    </section>
  );
}
