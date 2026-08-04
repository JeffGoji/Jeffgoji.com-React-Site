import carsData from './Cars.json';
import CarCard from '../common/CarCard';

/**
 * The garage hub: every car in the stable, one number-tagged card each.
 *
 * The card count in the eyebrow is read off the data rather than written into
 * the copy, so adding a car to Cars.json is the whole change.
 *
 * The masthead band is a <div> rather than a <header>: the shell's own <header>
 * already owns the page's banner landmark, and a second one competes with it
 * for assistive-technology navigation.
 */
const Garage = () => {
    const cars = carsData.cars;

    return (
        <section className="garage">
            <div className="garage__head section-tight">
                <div className="garage__inner">
                    <div className="eyebrow">The stable &middot; {cars.length} cars</div>
                    <h1 className="garage__title">Car Blogs</h1>
                    <p className="garage__lead">
                        Every car in the garage keeps its own running log &mdash; dated entries with
                        mileage, cost and the story behind the wrench. Pick one and start reading.
                    </p>
                </div>
            </div>
            <div className="section">
                <div className="garage__inner">
                    <div className="garage-grid">
                        {cars.map((car) => (
                            <CarCard key={car.id} variant="hub" {...car} />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Garage;
