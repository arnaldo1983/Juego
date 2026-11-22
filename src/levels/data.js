import { Builder } from './builder.js';

// Curva de diseño de cada nivel: enseñar -> practicar -> giro -> dominar.
// Coordenadas: y = 0 es la fila inferior; el suelo base ocupa y = 0..1 (superficie en y = 2).
// Entidades ('@', 'e', 'k', 'w', 'f', 'c', 'G') van en la casilla de los pies.

// --------------------------------------------------------------- 1-1
// Mundo 1-1: Pradera Dorada. Tutorial implícito sin textos.
function level1() {
  const b = new Builder(220, 15);
  b.ground(0, 219);

  // A) Enseñar: correr, saltar y golpear bloques. Las monedas indican el camino.
  b.put(3, 2, '@');
  b.coins(8, 3, 3);                          // pista: "sigue a la derecha"
  b.text(13, 5, '?');                        // primer bloque: moneda fácil
  b.arc(12, 7, 3, 1);
  b.text(18, 5, 'BMB');                      // la Fruta, protegida por ladrillos
  b.text(23, 8, 'B?B');                      // bloque alto: se llega desde los ladrillos
  b.coins(23, 10, 3);
  b.put(28, 2, 'e');                         // primer Bellotín: viene hacia ti en llano

  // B) Practicar alturas con columnas crecientes.
  b.pillar(32, 2, 2);
  b.arc(34, 5, 4, 2);
  b.pillar(38, 2, 3);
  b.put(36, 2, 'e');
  b.put(41, 9, '1');                         // secreto: 1UP alto, solo desde la columna
  b.pillar(45, 2, 4);
  b.put(42, 2, 'e').put(43, 2, 'e');
  b.coins(45, 7, 2);
  b.pillar(52, 2, 3);

  // Primer foso pequeño, con monedas en arco que dibujan el salto.
  b.pit(56, 58);
  b.arc(55, 4, 5, 3);

  // C) Doble camino: ladrillos bajos y un "camino alto" sobre un foso.
  b.text(63, 5, 'BB$B?B');                   // multimoneda escondida entre ladrillos
  b.put(67, 2, 'e').put(69, 2, 'e');
  b.text(72, 9, 'BBBBBBBBBBBBBBB');          // camino alto (opcional)
  b.coins(74, 10, 4);
  b.put(77, 10, 'e');
  b.pit(80, 83);                             // foso de 4 bajo el camino alto
  b.put(88, 2, 'e').put(90, 2, 'e');

  // D) El Escarabajo: patada al caparazón contra una fila de Bellotines.
  b.text(95, 5, 'B?B');
  b.put(98, 2, 'k');
  b.text(100, 6, 'BSB');                     // estrella tras el caparazón
  b.put(104, 2, 'e').put(106, 2, 'e').put(108, 2, 'e');
  b.pillar(112, 2, 2);                        // tope para el caparazón
  b.coins(112, 5, 2);

  // Punto de control a mitad de nivel.
  b.put(117, 2, 'c');

  // E) Giro: columnas que salen del abismo.
  b.pit(121, 123);
  b.pillar(124, 0, 4);
  b.coins(124, 5, 2);
  b.pit(126, 128);
  b.pillar(129, 0, 5);
  b.coins(129, 6, 2);
  b.pit(131, 133);
  b.arc(131, 6, 3, 1);
  b.put(136, 2, 'e').put(138, 2, 'e');

  // Colina de piedra con puente de ladrillos sobre un abismo (y un Bellotín en el puente).
  b.stairs(141, 2, 4, 1);
  b.pit(145, 150);
  b.text(145, 5, 'BBBBBB');
  b.put(148, 6, 'e');
  b.arc(145, 8, 6, 1);
  b.stairs(151, 2, 4, -1);

  // F) Dominar: bloques en sonrisa, más enemigos y un Escarabajo.
  b.text(157, 5, '?').text(159, 6, 'B?B').text(163, 5, '?');
  b.arc(158, 9, 5, 1);
  b.put(161, 2, 'e').put(163, 2, 'e').put(165, 2, 'e');
  b.pillar(168, 2, 3);
  b.put(172, 2, 'k').put(175, 2, 'e');
  b.pit(177, 180);
  b.arc(176, 5, 6, 3);
  b.text(183, 5, 'B?B');
  b.put(186, 2, 'e');

  // G) Escalera final y meta (con 10+ casillas libres detrás para la fortaleza).
  b.stairs(189, 2, 8, 1);
  b.rect(197, 2, 1, 8, 'X');
  b.coins(195, 12, 3);
  b.put(203, 2, 'G');
  return { id: '1-1', name: 'Pradera Dorada', theme: 'pradera', time: 400, rows: b.rows() };
}

// --------------------------------------------------------------- 1-2
// Mundo 1-2: Gruta de Cristal. Techo de roca, plataformas de un sentido y móviles.
function level2() {
  const b = new Builder(200, 15);
  b.ground(0, 199);
  b.ceiling(0, 183, 3);
  // estalactitas que cuelgan del techo (decoran y limitan saltos altos)
  for (const [x, w, d] of [[14, 3, 1], [27, 2, 2], [58, 3, 1], [92, 2, 1], [147, 3, 1], [176, 2, 1]]) b.rect(x, 12 - d, w, d, '#');

  // A) Enseñar las plataformas de un sentido.
  b.put(3, 2, '@');
  b.coins(7, 3, 3);
  b.text(11, 5, 'B?BMB');
  b.text(18, 5, '====');                     // se atraviesan desde abajo
  b.text(22, 8, '====');
  b.coins(22, 9, 4);
  b.put(26, 2, 'k');

  // Primeros pinchos: saltarlos o usar la plataforma.
  b.text(30, 2, '^^^');
  b.text(29, 5, '=====');
  b.arc(30, 6, 3, 1);

  // B) Primera plataforma horizontal sobre un abismo.
  b.pit(40, 50);
  b.put(44, 3, 'L');
  b.arc(41, 6, 9, 2);

  // C) Avispón y Escarabajos bajo una fila de cristal.
  b.put(56, 2, 'e');
  b.text(60, 5, 'BB$BB');
  b.put(63, 8, 'w');
  b.put(66, 2, 'k').put(70, 2, 'e');
  b.text(73, 2, '^^');

  // D) Ascensor vertical hasta una repisa alta.
  b.pit(79, 83);
  b.put(80, 5, 'V');
  b.island(84, 95, 8);
  b.coins(86, 9, 6);
  b.put(90, 11, '1');                        // secreto: 1UP incrustado en el techo, sobre la repisa
  b.put(93, 8, 'e');

  // Punto de control.
  b.put(100, 2, 'c');

  // E) Giro: pasillo de pinchos con repisas de un sentido y un avispón vigilando.
  b.text(104, 2, '^^^^^^^^^^^^^^^');
  b.text(103, 5, '===');
  b.text(108, 6, '===');
  b.text(113, 5, '===');
  b.text(117, 4, '===');
  b.coins(108, 7, 3);
  b.put(111, 9, 'w');

  // Túnel bajo con Escarabajos y estrella.
  b.rect(127, 9, 14, 4, '#');
  b.text(131, 5, 'B?BSB');
  b.put(134, 2, 'k').put(138, 2, 'e').put(140, 2, 'e');

  // F) Dominar: dos plataformas horizontales sincronizadas sobre un abismo largo.
  b.pit(152, 168);
  b.put(155, 4, 'L');
  b.put(162, 4, 'L');
  b.put(160, 9, 'w');
  b.coins(157, 8, 2).coins(164, 8, 2);

  // G) Salida de la gruta: escalera y meta a cielo abierto.
  b.put(172, 2, 'e');
  b.stairs(174, 2, 5, 1);
  b.rect(179, 2, 1, 5, 'X');
  b.put(187, 2, 'G');
  return { id: '1-2', name: 'Gruta de Cristal', theme: 'cueva', time: 350, rows: b.rows() };
}

// --------------------------------------------------------------- 1-3
// Mundo 1-3: Islas del Atardecer. Islas flotantes, abismos y saltos con carrerilla.
function level3() {
  const b = new Builder(200, 15);

  // A) Enseñar: islas cercanas, monedas en arco marcan cada salto.
  b.ground(0, 14);
  b.put(3, 2, '@');
  b.text(9, 5, '?');
  b.arc(14, 4, 5, 2);
  b.island(18, 23, 4);
  b.arc(23, 6, 6, 2);
  b.island(28, 31, 5);

  // Nubes de un sentido.
  b.text(35, 6, '===');
  b.arc(37, 8, 5, 1);
  b.text(41, 8, '===');
  b.text(47, 6, '===');
  b.arc(43, 10, 5, 1);

  // B) Isla con Bellotines y la Fruta.
  b.island(52, 60, 3);
  b.text(55, 7, 'BMB');
  b.put(57, 3, 'e').put(59, 3, 'e');

  // Primer salto con carrerilla (hueco de 8): las monedas dibujan el arco.
  b.arc(60, 5, 9, 3);
  b.island(69, 73, 3);

  // C) Plataforma horizontal sobre el vacío.
  b.put(78, 3, 'L');
  b.coins(77, 7, 6);
  b.island(87, 92, 5);
  b.put(90, 5, 'k');
  b.put(88, 9, '1');                         // secreto sobre la isla

  // Ascensor vertical a la isla alta.
  b.put(94, 6, 'V');
  b.island(99, 106, 9, 3);
  b.put(102, 9, 'c');
  b.coins(100, 11, 6);

  // D) Giro: bajada de islas con avispones.
  b.island(110, 113, 7, 2);
  b.put(115, 10, 'w');
  b.island(117, 120, 5, 2);
  b.arc(120, 7, 4, 1);
  b.island(124, 136, 3);
  b.text(127, 7, 'B$B');
  b.put(131, 11, 'S');                       // estrella: salto desde los ladrillos
  b.put(130, 3, 'e').put(133, 3, 'e').put(135, 3, 'e');

  // Segundo salto con carrerilla (hueco de 8) con avispón alto.
  b.arc(136, 5, 9, 4);
  b.put(140, 11, 'w');
  b.island(145, 149, 3);

  // E) Dominar: dos plataformas sincronizadas y avispones.
  b.put(151, 4, 'L');
  b.put(158, 4, 'L');
  b.put(156, 9, 'w');
  b.coins(152, 8, 2).coins(159, 8, 2);
  b.island(167, 172, 4);
  b.put(170, 4, 'e');

  // F) Nubes finales y meta.
  b.text(175, 5, '===');
  b.text(179, 7, '===');
  b.coins(180, 8, 2);
  b.island(184, 199, 2);
  b.stairs(184, 2, 4, 1);
  b.put(189, 2, 'G');
  return { id: '1-3', name: 'Islas del Atardecer', theme: 'cielo', time: 300, rows: b.rows() };
}

// --------------------------------------------------------------- 1-4
// Mundo 1-4: Fortaleza Volcánica. Lava, pinchos y plantas ígneas.
function level4() {
  const b = new Builder(200, 15);
  b.ground(0, 199);
  b.ceiling(26, 46, 2, 'X');
  b.ceiling(96, 118, 2, 'X');

  // A) Enseñar: primer foso de lava y primera planta ígnea.
  b.put(3, 2, '@');
  b.text(8, 5, 'M');
  b.pit(13, 15, '~');
  b.firePillar(20, 2, 3);
  b.pit(26, 29, '~');

  // Pasillo bajo con pinchos y un Escarabajo.
  b.rect(30, 9, 16, 4, 'X');
  b.text(34, 2, '^^');
  b.put(39, 2, 'k');
  b.text(40, 5, 'X?X');

  // B) Lago de lava con columnas.
  b.pit(47, 58, '~');
  b.pillar(49, 0, 4);
  b.pillar(54, 0, 4);
  b.put(52, 8, 'w');
  b.coins(49, 6, 2).coins(54, 6, 2);

  // Plantas ígneas gemelas con un Escarabajo entre ellas.
  b.firePillar(64, 2, 2);
  b.put(67, 2, 'k');
  b.firePillar(70, 2, 3);

  // C) Plataforma horizontal sobre lava.
  b.pit(78, 90, '~');
  b.put(81, 3, 'L');
  b.coins(80, 7, 6);

  b.put(95, 2, 'c');

  // D) Suelo de pinchos con bloques de piedra y un avispón.
  b.text(100, 2, '^^^^^^^^^^^^^');
  b.rect(103, 2, 2, 2, 'X');
  b.rect(107, 2, 2, 3, 'X');
  b.rect(111, 2, 2, 2, 'X');
  b.put(109, 8, 'w');
  b.text(106, 7, 'M');                     // Fruta/Flor tras el punto de control

  // E) Giro: ascensor sobre lava hasta la muralla, con planta ígnea arriba.
  b.pit(120, 126, '~');
  b.put(122, 5, 'V');
  b.island(127, 140, 8, 8, 'X');
  b.firePillar(133, 8, 2);
  b.coins(130, 10, 2).coins(137, 10, 2);

  // F) Dominar: lava, plantas y enemigos en serie.
  b.put(144, 2, 'e').put(146, 2, 'k');
  b.firePillar(149, 2, 2);
  b.pit(152, 155, '~');
  b.firePillar(158, 2, 3);
  b.pit(161, 163, '~');
  b.put(166, 6, 'w');
  b.put(168, 2, 'k');

  // Escalera final y meta.
  b.stairs(171, 2, 6, 1);
  b.rect(177, 2, 1, 6, 'X');
  b.pit(178, 179, '~');
  b.put(184, 2, 'G');
  return { id: '1-4', name: 'Fortaleza Volcánica', theme: 'castillo', time: 300, rows: b.rows() };
}

export const LEVELS = [level1(), level2(), level3(), level4()];
