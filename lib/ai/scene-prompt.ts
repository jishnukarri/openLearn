// Prompt text that teaches a model to write an animated worked-example scene.
// Pure (no server-only) so the model comparison script can reuse it.

export const WORKED_EXAMPLE_GUIDE =
  `\n\nEVERY worked example must be a visual animation, not text. For each ` +
  `section write "exampleScene" (strongly preferred): a small JSON scene ` +
  `the site animates step by step. Shape: {"w":400,"h":260,"captions":[3-5 ` +
  `short sentences, one per step, last one gives the answer],"elements":[...]}. ` +
  `Each element has "type" (circle{cx,cy,r,fill,stroke} | rect{x,y,w,h,rx,fill,stroke} | ` +
  `line/arrow{x1,y1,x2,y2,stroke,dashed} | path{d,fill,stroke} (curves: M L C Q only) | ` +
  `text{x,y,text,size 12-20,anchor,fill} | group{children:[...]}), ` +
  `"step" (0-based index of the caption at which it appears), optional ` +
  `"enter" (fade | draw for line/arrow/path | scale | slide) and optional ` +
  `looping "motion": {"type":"pulse"} | {"type":"flow","dots":3} on a ` +
  `line/arrow/path (dots travel along it) | {"type":"orbit","cx","cy","radius"} ` +
  `on a circle | {"type":"oscillate","axis":"x","amount":12}. Colours ONLY ` +
  `these names: ink, muted, primary, secondary, highlight, success, error, ` +
  `light, white, none (drawn on a white panel). Keep all text inside 0..w ` +
  `and short; at most 40 elements. Draw the actual situation with real ` +
  `labels and numbers; reveal it in order (setup, then each step, then the answer).\n` +
  `LAYOUT RULES (labels must never overlap): plan a grid first. Never put two texts ` +
  `within 24px vertically if their horizontal extents overlap (text width is about ` +
  `0.58*size per character). Give each label its own clear band, 8px+ away from lines, ` +
  `arrows and other labels. Title at the top (y 24). Object labels sit directly beside, ` +
  `above or below their object (short leader line if needed). Dimension or measurement ` +
  `labels go outside the shape, centred on their dimension line but 14px away from it, ` +
  `never ON the line. Max 6 texts per step, each under 28 characters, size 14-18. Keep ` +
  `16px margin to the canvas edge. One idea per step; a label that persists keeps the same coordinates.\n` +
  `Example A (field lines, 3 steps): {"w":400,"h":260,"captions":["A positive charge sits in space.","Field lines point away from it.","A positive test charge is pushed along a line."],"elements":[` +
  `{"type":"circle","cx":200,"cy":130,"r":16,"fill":"error","step":0,"enter":"scale"},` +
  `{"type":"text","x":200,"y":136,"text":"+","size":18,"anchor":"middle","fill":"white","step":0},` +
  `{"type":"arrow","x1":220,"y1":130,"x2":330,"y2":130,"stroke":"primary","step":1,"enter":"draw","motion":{"type":"flow","dots":2}},` +
  `{"type":"arrow","x1":186,"y1":116,"x2":110,"y2":40,"stroke":"primary","step":1,"enter":"draw"},` +
  `{"type":"circle","cx":0,"cy":0,"r":7,"fill":"success","step":2,"enter":"scale","motion":{"type":"orbit","cx":200,"cy":130,"radius":90}},` +
  `{"type":"text","x":200,"y":250,"text":"Force on test charge","size":14,"anchor":"middle","step":2}]}\n` +
  `Example B (velocity-time graph, 3 steps): {"w":400,"h":260,"captions":["Axes: time across, velocity up.","Constant acceleration draws a straight line.","The gradient of the line is the acceleration."],"elements":[` +
  `{"type":"arrow","x1":50,"y1":210,"x2":370,"y2":210,"stroke":"ink","step":0,"enter":"draw"},` +
  `{"type":"arrow","x1":50,"y1":210,"x2":50,"y2":20,"stroke":"ink","step":0,"enter":"draw"},` +
  `{"type":"text","x":370,"y":232,"text":"time (s)","size":14,"anchor":"end","step":0},` +
  `{"type":"text","x":56,"y":32,"text":"velocity (m/s)","size":14,"step":0},` +
  `{"type":"path","d":"M50 210 L300 50","stroke":"primary","step":1,"enter":"draw"},` +
  `{"type":"line","x1":150,"y1":210,"x2":150,"y2":146,"stroke":"secondary","dashed":true,"step":2,"enter":"draw"},` +
  `{"type":"text","x":160,"y":190,"text":"gradient = a","size":14,"fill":"secondary","step":2}]}\n` +
  `If a scene truly cannot show the idea, fall back to "exampleVisual" ` +
  `(same shape as "visual": kind "svg" labelled diagram, or "image"). ` +
  `Always also write "exampleSteps": 3-5 short sentences (matching the ` +
  `captions) and keep "example" as the full text version.`;
