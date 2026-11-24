/**
 * Picks one frame from the hero's shot list, giving every car an equal chance
 * regardless of how many frames it has.
 *
 * A flat pick over the list would weight each car by its frame count, so a car
 * with five shots would lead the home page five times as often as a car with
 * one. Instead the roll first chooses a car — cars are grouped by `name`, in
 * order of first appearance — and the remainder of the same roll chooses a frame
 * within it. One roll for both steps keeps the Hero's "one Math.random call per
 * mount" contract, and the remainder of a uniform roll is itself uniform, so the
 * frame choice is fair within the car.
 *
 * @template {{name: string}} T
 * @param {T[]} shots
 * @param {number} roll A value in [0, 1), as Math.random returns.
 * @returns {T}
 */
export function pickShot(shots, roll) {
    const cars = []
    const byCar = new Map()

    for (const shot of shots) {
        if (!byCar.has(shot.name)) {
            byCar.set(shot.name, [])
            cars.push(shot.name)
        }

        byCar.get(shot.name).push(shot)
    }

    const scaled = roll * cars.length
    const carIndex = Math.min(Math.floor(scaled), cars.length - 1)
    const frames = byCar.get(cars[carIndex])
    const frameIndex = Math.min(Math.floor((scaled - carIndex) * frames.length), frames.length - 1)

    return frames[frameIndex]
}
