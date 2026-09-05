// Wie zähflüssige Masse auf dieselbe Geste antwortet wie Flüssigkeit.
//
// Die Slosh-Maschine liefert `tilt`: den Winkel einer unterdämpften Feder. Für
// Flüssigkeit ist das richtig — sie schwingt über die Ruhelage hinaus, schwappt
// zurück und pendelt sich ein. Gel tut das nicht. Es kriecht der Bewegung
// hinterher und bleibt stehen, wo es angekommen ist.
//
// Deshalb wird die Federantwort nicht übernommen, sondern gefiltert: ein
// Verzögerungsglied erster Ordnung auf denselben Eingang. Es kann seinen
// Zielwert nie überschreiten — genau das ist der Unterschied zwischen
// „schwappt" und „fliesst zäh".

// Zeitkonstante in Sekunden. Nach ihr hat die Masse 63 % des Weges zurückgelegt.
// Gross genug, dass sie dem schnellen Hin und Her der Feder gar nicht folgen
// kann und stattdessen deren Mittel nachzieht.
export const GEL_TIME_CONSTANT = 0.38

// Wie weit die Masse an einer Wand hochsteigt, in viewBox-Einheiten bei vollem
// Ausschlag. Die Flüssigkeit nimmt dafür 22 (`TILT_RISE` in liquidGeometry) —
// ein Viertel davon, weil eine zähe Masse sich kaum aufwerfen lässt.
export const GEL_TILT_RISE = 6

// Ein Schritt des Verzögerungsglieds. Rein, damit sich der Charakter ohne
// requestAnimationFrame prüfen lässt — wie `stepSlosh` bei der Feder.
export function stepGelFlow(current: number, target: number, dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return current
  if (!Number.isFinite(current) || !Number.isFinite(target)) return current
  // Exponentielle Annäherung statt current + (target-current)*dt*k: so hängt
  // das Ergebnis nicht von der Bildrate ab.
  const k = 1 - Math.exp(-dt / GEL_TIME_CONSTANT)
  return current + (target - current) * k
}

// Der Neigungswinkel in Grad, den ein Wandanstieg über die Kammerbreite ergibt.
// Die Oberfläche kippt darum, der Boden bleibt liegen.
export function gelTiltDegrees(rise: number, halfWidth: number): number {
  return (Math.atan2(rise, halfWidth) * 180) / Math.PI
}
