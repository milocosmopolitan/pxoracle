# Tarot body and material generation prompts

Built-in `image_gen` was used, with transparent background for the torso and opaque background for both albedo tiles. Selected files are stored under `apps/web/public/art/hand-mesh/`. Original user artwork is unchanged. The final torso edit used the first generated torso as its edit target; that rejected broad-shouldered variant is not shipped.

## oracle-torso.png, final edit

Edit this exact pixel-art character layer for skeletal compositing. Preserve the face, glasses, hair, necklace, black turtleneck, lighting and indigo-gold cloth exactly. The character must have NO ARMS, NO SLEEVES and NO SIDE CAPE WINGS. Remove the broad cloth flares on both sides that currently look like sleeve stumps. Keep only the head, natural narrow shoulders, central chest and complete central torso continuing down through the seated hips. The shawl is two narrow vertical drapes over the front of the chest, not arm-shaped cloth on the sides. Reconstruct all fabric across the abdomen that could be exposed when independent 3D arms raise. Sides from armpits to hips have a clean natural torso silhouette; do not show skin or cut wounds. Complete bottom of seated torso, not cropped horizontally through the chest. Front view, genuine transparent background, full head and hip with margins. Production isolated body layer. No arms, hands, table, furniture, text or separate fragments.

## skin-albedo.png

Production game material texture, square seamless tileable diffuse/albedo only. A close flat surface swatch of warm medium tan elderly human skin, subtle fine creases and sparse tiny age freckles, restrained realistic pixel-art texel clusters matching a detailed warm-lit pixel art fortune teller. Uniform average color muted warm tan #b98b6d, low contrast. Perfectly flat even neutral lighting, no baked highlights or directional shadows. Edge-to-edge skin surface, no hands, no fingers, no body silhouettes, no hair, no text, no borders, no objects. This tile will UV-wrap a rigged elderly character's forearms and hand mesh, so the pattern must be fine, restrained and seamless. 1024 square.

## cloth-albedo.png

Production game material texture. Square seamless repeating diffuse/albedo tile of deep midnight indigo purple woven wool cloth for an elderly fortune teller's sleeves. Dense subtly visible woven threads and flecked warm bronze fibers; sparse tiny antique-gold embroidered four-point star stitches scattered at an even scale, no large motifs. Detailed pixel-art texture matching dark purple robes in a warm lamplit mystical study. Overall dark muted #282237 with low contrast bronze #8c7050 accents. Flat unlit fabric surface, perfectly even neutral lighting, no baked folds, no shading, no highlights, no seams, no hems, no borders, no text, no objects, no hands or people. Edge-to-edge seamless tile, not a garment picture. Will wrap around cylindrical 3D sleeves and shoulder caps with UV coordinates. 1024 square.

## 2026-10-11 replacements after visual feedback

Built-in image_gen edits; original project art is unchanged. The intermediate narrow `oracle-torso.png` is no longer shipped. These prompts are for the selected runtime assets, not an approval claim.

### oracle-front-v4.png

Production 2.5D game character torso replacement. Edit this exact elderly oracle, preserve her identity, age, face, round gold glasses, gray bun, dark midnight indigo turtleneck and navy wool celestial shawl, restrained original pixel art and original amber-left/cool-right lighting. Front eye-level seated view. Remove the table, chair, both hands and both arms entirely. Reconstruct the complete chest, abdomen and seated hips underneath, keep the natural broad shoulder/clavicle silhouette and shoulder cloth extending to the arm socket; no narrow neck-like torso, no detached stumps, no cylindrical sleeve shapes, no cape wings hanging where the arms would be. The torso should look like a sleeveless fitted version of her same dark robe with short overlapping shawl shoulder yokes covering the future 3D sleeve seams. Entire head through seated hips within frame, balanced realistic head/body proportions matching original. Cloth base near #141525 with low-contrast plum/navy yarn, subdued sparse gold stars; no bright purple scarves. Dense small square hand-painted pixel clusters, not smooth vector shading. Genuine transparent background. This is only the complete armless body plate; separate 3D limbs will be attached at the shoulders.

### oracle-oblique-v4.png

Create the matching elevated-camera view of this exact armless oracle body for the same 2.5D game. Camera is in FRONT and ABOVE her, looking downward about 45 degrees from the horizontal; she is seated leaning gently toward the table and looking down at the cards, NOT looking up at the viewer. Show visibly more TOP of her gray bun, crown and shoulders, foreshorten face/chest correctly for this elevated camera. Preserve exact elderly identity, glasses, midnight indigo turtleneck, dark navy shawl shoulder yokes, gold moon necklace and restrained pixel artwork, amber left / muted cool right lighting. Same complete body from entire bun through seated hips and shoulder width; no arms, sleeves, hands, table, chair, background or props. Reconstruct entire armless torso with natural shoulder sockets covered by cloth yokes for separate 3D sleeves. Transparent background. This is a separately DRAWN elevated projection, do not just tilt, squash or rotate the frontal picture. Keep matching dark navy material palette and fine square pixel clusters; no smooth vector surfaces.

### walnut-albedo.png

Seamless square PBR BASE COLOR texture tile for the old walnut desk and wooden floor of an intimate nocturnal pixel-art oracle study. Straight flat orthographic material sample filling every edge, rich muted dark brown walnut, fine long grain primarily horizontal, subtle hand wear, restrained knots and pores, low-contrast warm umber #402d24 and charcoal brown #231e1b. Mature detailed hand-painted pixel clusters matching dark fantasy pixel art, no large cartoon blocks. NO perspective, NO light sources, NO cast shadows, NO baked highlights, NO borders, NO furniture, NO plank seams, NO props, NO text. Even diffuse neutral material lighting. Tileable all four edges. Grain visible but subdued, to be lit in a realtime PBR shader.

### reading-mat.png

Extract/recreate ONLY the entire rectangular tarot reading mat as a production flat top-down texture, removing ALL the wooden table around it. The complete mat including all FOUR gold stitched edges and all FOUR rounded corners must fit inside the image with a tiny transparent margin, absolutely no cropped border. Preserve aged deep muted petrol/indigo velvet cloth and restrained antique gold double-line stitching, subtle sparse worn celestial flourishes in the corners. Keep centre quiet and empty for cards, no new symbols or objects. Aspect ratio about 1.75:1, mat fills 96% of canvas. True vertical orthographic view, no perspective, neutral EVEN light, remove the bright left-side baked lighting from the reference so a realtime PBR shader can light it. Fine mature pixel-art fabric texture, dark subdued blue-green, not bright teal, no gray backing, no wood, no shadow outside mat. Real alpha transparency.

## Original floor and table references, 2026-10-11

Built-in image_gen, separate calls, opaque square images. Inputs were inspected at their absolute workspace paths. Original `room.webp` and `table.webp` remain unchanged.

### Floor

Reference: `apps/web/public/art/room.webp`. Output: `apps/web/public/art/hand-mesh/floor-reference-albedo.png`.

> Create a production seamless square UV albedo texture of ONLY the wooden FLOOR in the bottom of the reference room artwork. Match its fine pixel-art painted texture exactly: dark espresso brown aged long wide horizontal wooden boards, fine warm amber grain streaks, staggered narrow dark joints, subtle worn lacquer and irregular pixel clusters. Orthographic straight overhead surface texture filling every pixel, no room, no furniture, no perspective, no border. Keep the floor distinctly dark brown but readable. Neutral even lighting, no baked large light reflections, no blue light patches, no cast shadows; runtime PBR lighting will provide amber and blue reflections. Tileable on all four sides. Not photorealistic, not smooth vector, not generic procedural noise. Detailed restrained pixel art at the reference artwork's pixel scale. 1024 square.

### Table

Reference: `apps/web/public/art/table.webp`. Output: `apps/web/public/art/hand-mesh/table-reference-albedo.png`.

> Create a square production UV albedo texture matching ONLY the wooden TABLETOP surface of this reference pixel-art table. Exact art direction: warm honey amber and reddish brown varnished aged wood, long flowing horizontal dark grain, subtle oval knots and scattered fine golden pixel scratches, a few broad horizontal board joins. Rich fine pixel-art clusters as in the reference, not photorealistic, not vector, not monochrome generic noise. Straight overhead orthographic material covering the entire square, seamless tile on four sides. No table silhouette, no legs, no border, no transparency, no perspective. Neutral even lighting without baked directional shadows or lamp highlights so runtime PBR lighting can shade it. Keep distinctly warmer and brighter than dark espresso floorboards. 1024 square.
