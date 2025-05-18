function Swaybars() {
  return (
    <div className="text-start mb-5">
          <p><strong>Swaybars</strong> in general are the icing on the cake of suspension tuning. Unless you are stuck in an autocross class where they are the primary source of increasing the roll-resistance much like bumpstops in the previous section. For the rest of the world as a rule, the swaybar should be considered one of the final peices to your suspension puzzle and selected after everything else has been accounted for.</p>
      <p>
        Swaybars (anti-roll bars, ARBs) are torsion springs that link opposite wheels across an axle. By resisting roll (body tilt) during cornering, they help keep tires flat on the road, sharpen turn-in, and tune under-/over-steer balance. Unlike springs, swaybars only engage when one wheel moves relative to the other, so they stiffen roll without affecting straight-line ride compliance.
      </p>

      <h3>How Swaybar “Rate” Works</h3>
      <p>
        A swaybar’s <strong>rate</strong> is its torsional stiffness, often expressed as lb/in (force to twist the bar 1 inch) or ft-lb/deg (torque per degree of twist). Rate scales roughly with the fourth power of diameter (d⁴), so small diameter changes yield big stiffness gains. Adjustable bars provide multiple end-link positions to fine-tune effective leverage and balance.
      </p>

      <h3>Miata Swaybar Specs by Generation</h3>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Generation</th>
            <th>Years</th>
            <th>Stock Front (dia)</th>
            <th>Stock Rear (dia)</th>
            <th>Stock Rate Front</th>
            <th>Stock Rate Rear</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>NA/NB</strong></td>
            <td>1990–2005</td>
            <td>19 mm hollow; R-Package: 20 mm</td>
            <td>12 mm solid</td>
            <td>~120 lb/in</td>
            <td>~40 lb/in</td>
          </tr>
          <tr>
            <td><strong>NC</strong></td>
            <td>2006–2015</td>
            <td>21.1 mm hollow</td>
            <td>11.2 mm solid (base) / 12.1 mm (sport)</td>
            <td>≈160 lb/in*</td>
            <td>≈50 lb/in*</td>
          </tr>
          <tr>
            <td><strong>ND</strong></td>
            <td>2016+</td>
            <td>22.9 mm hollow</td>
            <td>11.2 mm solid</td>
            <td>≈180 lb/in*</td>
            <td>≈30 lb/in*</td>
          </tr>
        </tbody>
      </table>

      <p>* Estimated from diameter scaling; actual rates vary by arm length and mounting geometry.</p>

      <h3>Aftermarket & Application Recommendations</h3>

      <h4>NA/NB (1990–2005)</h4>
      <p><strong>Street:</strong></p>
      <ul>
        <li>
          <strong>Racing Beat</strong> hollow tubular front bars (15/16″ OD) and solid rears offer a balance of roll control and compliance; popular at ~$180 front, $90 rear.
        </li>
        <li>
          <strong>Flying Miata</strong> solid bars (1.0″ front, 0.625″ rear) with multiple adjustment holes for fine-tuning.
        </li>
      </ul>
      <p><strong>Autocross:</strong></p>
      <ul>
        <li>
          Maximum front: Racing Beat 1.125″ tubular yields ~857 ft-lb/deg of roll torque—among the stiffest readily available.
        </li>
        <li>
          Rear bar often removed for pure understeer bias, or replaced with an adjustable 11 mm bar to dial in oversteer.
        </li>
      </ul>

      <h4>NC (2006–2015)</h4>
      <p><strong>Street:</strong></p>
      <ul>
        <li>Base OEM: 21 mm front/11 mm rear provides mild roll control.</li>
        <li>Sport OEM: same 21 mm front with 12 mm rear adds a bit of rear stiffness.</li>
        <li>Flyin’ Miata hollow 1″ front, 0.75″ rear adjustable; keeps compliance while flattening roll.</li>
        <li>Whiteline/Eibach/SuperPro offer 24 mm front and 16 mm rear bars with multi-position adjustability.</li>
      </ul>
      <p><strong>Autocross:</strong></p>
      <ul>
        <li>
          Step up to 25.4–28.6 mm front (RX-8 bars or Progress: 25.4 mm/3.3 mm and 26.8 mm/3.5 mm options) paired with a minimal 16 mm rear or removal.
        </li>
        <li>Adjust leverage to dial in transitional response and rotation.</li>
      </ul>

      <h4>ND (2016+)</h4>
      <p><strong>Street:</strong></p>
      <ul>
        <li>ND OEM: 22.9 mm hollow front, 11.2 mm solid rear.</li>
        <li>Flyin’ Miata 1.125″ OD front × 0.188″ wall, 0.625″ solid rear, three-position adjustable.</li>
        <li>Cusco offers 24 mm front and 14 mm solid rear; RoadsterSport combos also popular.</li>
      </ul>
      <p><strong>Autocross:</strong></p>
      <ul>
        <li>Use FM’s 1.125″ front for maximum roll control; pair with a lightweight 14 mm rear or disconnect to tune bias.</li>
      </ul>

      <h3>Street vs. Autocross Setups</h3>
      <ol>
        <li>
          <strong>Street:</strong> aim for balanced mid-corner grip with moderate bars (front: ~1.0″/25 mm; rear: 0.625″–0.75″/16–19 mm). Adjustable bars allow dialing for highway comfort and canyon carving.
        </li>
        <li>
          <strong>Autocross:</strong> maximize front roll stiffness (≥1.125″/28 mm), minimize rear (remove or use ≤11 mm) for a safe understeer bias and quick transitions and getting power down early with a Torsen LSD or viscous LSD.
        </li>
      </ol>

      <h3>Conclusion</h3>
      <p>
        By generation, Miata stock swaybars advance modestly from NA’s 19 mm to NC’s 21 mm and ND’s 22.9 mm fronts, with rear bars hovering around 11–12 mm. Aftermarket offerings span 19 mm–28 mm, with adjustability catering to everything from daily-driven grip to razor-sharp autocross performance. Matching bar diameter, wall thickness, and leverage ensures the perfect balance of roll control, compliance, and steering feel.
      </p>
    </div>
  );
}

export default Swaybars;