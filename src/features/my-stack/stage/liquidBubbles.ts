import { createContext } from 'react'

/**
 * Duerfen die Blasen in der Fluessigkeit aufsteigen?
 *
 * Im Karussell ja, dort stehen zwei, drei Objekte. Im Raster stehen bis zu
 * zwoelf auf einmal sichtbar — die Blasen sind SMIL-Animationen und kosteten
 * schon im Karussell mehr Stilberechnung als alles andere. Dort bewegt sich
 * nur die Oberflaeche.
 */
export const LiquidBubblesContext = createContext(true)
