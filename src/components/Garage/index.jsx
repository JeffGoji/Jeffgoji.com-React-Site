// Import JSON data
import carsData from './Cars.json';
import Cards from './Cards';

const Garage = () => {
    return (
        <div className="container-fluid mt-4">
            <div className="row justify-content-center p-0 m-0">
                <div className="col-lg-5 col-md-4 col-sm-4">
                    <hr />
                    <hr />
                </div>
                <div className="col-lg-2 col-md-4 col-sm-4">
                    <h1 className="text-center mb-3 text-outline fw-bold">Car Blogs</h1>
                </div>
                <div className="col-lg-5 col-md-4 col-sm-4">
                    <hr />
                    <hr />
                </div>
            </div>
            <div className="row p-0 m-0">
                {carsData.cars.map((car) => (
                    <Cards
                        key={car.id}
                        id={car.id}
                        model={car.model}
                        description={car.description}
                        name={car.name}
                    />
                ))}
            </div>
        </div>
    );
};

export default Garage;

