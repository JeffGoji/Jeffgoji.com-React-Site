/**
 * Builds a <BlogList> `banner` prop out of the identity a car already declares
 * in Cars.json.
 *
 * The four blog routes would otherwise each restate their car's year, make,
 * model, status and portrait as banner copy, which is the same drift the
 * pre-V2 id-keyed image map had: two records of one car, free to disagree. The
 * garage card and the blog banner now read the same row.
 *
 * The odometer chip is derived from the newest log entry rather than written
 * into the banner, because a hardcoded figure is stale the moment the next
 * entry lands.
 */

import carsData from '../Garage/Cars.json';
import { resolveCarImage } from './carImages';

/**
 * @param {string} name the `name` a Cars.json row carries, e.g. "Miyoshi"
 * @param {Array<{id:number,mileage?:string}>} entries that car's *Blog.json array
 * @returns {{image:string,imageAlt:string,eyebrow:string,title:string,chips:Array<{label:string,value:string}>}}
 */
export const buildCarBanner = (name, entries) => {
    const car = carsData.cars.find((row) => row.name === name);
    const newest = [...entries].sort((a, b) => b.id - a.id)[0];

    return {
        image: resolveCarImage(car.img),
        imageAlt: `${car.year} ${car.make} ${car.model} — ${car.name}`,
        eyebrow: `${car.year} ${car.make} · ${car.model}`,
        title: car.name,
        chips: [
            ...(newest?.mileage ? [{ label: 'ODO', value: `${newest.mileage} mi` }] : []),
            { label: 'STATUS', value: car.tag },
        ],
    };
};
