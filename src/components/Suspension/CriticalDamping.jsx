function CriticalDamping() {
    return (
        <div className="text-start mb-5">
            <p>
                In suspension tuning, the <strong>low-speed</strong> damping ratio (often expressed as a percentage of “critical damping,” ζ) governs how the car responds to slow body motions—think roll under cornering, dive under braking, and squat under acceleration.
            </p>

            <ol>
                <li>
                    <strong>Street Cars (<em>ζ ≈ 20–30 % critical</em>)</strong>
                    <ul>
                        <li>
                            <strong>Comfort priority:</strong> A lower ζ lets the chassis pitch and roll more freely, which softens the ride and isolates occupants from undulations in the pavement.
                        </li>
                        <li>
                            <strong>Forgiving handling:</strong> If the car leans or dives too abruptly, it can feel twitchy to everyday drivers. A moderate damping ratio smooths transitions and keeps the car feeling predictable at typical road speeds.
                        </li>
                        <li>
                            <strong>Broader operating window:</strong> Consumers drive on surfaces from satin-smooth highways to broken concrete. A lower ζ provides a wider “sweet spot” so that both small and mid-speed inputs aren’t overly punished.
                        </li>
                    </ul>
                </li>
                <li>
                    <strong>Race Cars (<em>ζ ≈ 40–60 % critical</em>)</strong>
                    <ul>
                        <li>
                            <strong>Performance focus:</strong> Higher low-speed damping controls weight transfer more aggressively—minimizing body roll, brake dive, and squat—so tire contact patches remain as consistent as possible through high-G maneuvers.
                        </li>
                        <li>
                            <strong>Sharper response:</strong> Racing drivers demand instant turn-in and a neutral balance. The stiffer low-speed valving reduces chassis pitch and yaw lags, giving more precise feedback.
                        </li>
                        <li>
                            <strong>Narrow tuning window:</strong> Racetracks are relatively smooth and predictable, so engineers can dial in a higher ζ without worrying excessively about harshness over potholes.
                        </li>
                    </ul>
                </li>
            </ol>

            <p>
                <strong>High-Speed vs. Low-Speed Damping</strong><br />
                Suspension dampers are effectively two dampers in one: <strong>low-speed</strong> valving for slow chassis motions, and <strong>high-speed</strong> valving for rapid wheel impacts.
            </p>

            <table className="table">
                <thead>
                    <tr>
                        <th>Aspect</th>
                        <th>Low-Speed Damping</th>
                        <th>High-Speed Damping</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Piston Velocity Range</td>
                        <td>&lt;= 0.08 m/s (≤ 3 in/s)</td>
                        <td>&gt;= 0.08 m/s (≥ 3 in/s)</td>
                    </tr>
                    <tr>
                        <td>Primary Controls</td>
                        <td>Roll, dive, squat; driver-initiated weight transfer</td>
                        <td>Road-surface irregularities; wheel hop; harshness</td>
                    </tr>
                    <tr>
                        <td>Valve Design</td>
                        <td>Smaller shim stacks or fixed orifices engineered for fine metering at low flow</td>
                        <td>Heavier shims or bypass passages that only activate under high flow pressures</td>
                    </tr>
                    <tr>
                        <td>Tuning Effects</td>
                        <td>
                            Influences balance and transient response; governs pitch and roll settling time; strong effect on lap-to-lap consistency
                        </td>
                        <td>
                            Protects chassis from jarring impacts; prevents chassis “packing” or “porpoising” at speed; keeps tires in contact over ripples
                        </td>
                    </tr>
                    <tr>
                        <td>Typical Adjustment</td>
                        <td>Adjustable clickers or shim stacks allowing ~10–60 clicks of tuning</td>
                        <td>Often a separate knob or shim stack, with coarse adjustment for harshness control</td>
                    </tr>
                    <tr>
                        <td>Trade-Offs</td>
                        <td>Too stiff → twitchy handling; Too soft → wallowy response</td>
                        <td>Too stiff → very harsh ride, can upset tire grip on repeat bumps; Too soft → risk of bottoming out, excessive packing of suspension</td>
                    </tr>
                </tbody>
            </table>

            <p>
                <strong>Putting It All Together</strong><br />
                A well-tuned damper blends these two regimes so that:
            </p>
            <ol>
                <li>
                    <strong>Low-speed valving</strong> maintains body control and driver confidence during corner entry, braking, and acceleration.
                </li>
                <li>
                    <strong>High-speed valving</strong> soaks up sharp bumps and keeps the tire in touch with the road without transmitting brutal shock loads to the chassis.
                </li>
            </ol>

            <p>
                On street cars, engineers skew the balance toward low-speed compliance for comfort, with just enough high-speed damping to prevent bottoming or feeling floaty. Racers invert that emphasis—maximizing low-speed firmness for razor-sharp handling while relying on high-speed damping primarily as protection against chassis damage and tire unloading at speed.
            </p>
        </div>
    );
}

export default CriticalDamping;
