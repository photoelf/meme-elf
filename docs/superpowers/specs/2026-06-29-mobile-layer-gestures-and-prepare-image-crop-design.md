# Mobile Layer Gestures And Prepare Image Crop Design

## Goal

Close the last mobile beta interaction gap before wider release by adding direct touch manipulation for layers in the main editor and restoring crop inside the `Prepare image` modal on phones.

## Scope

This design covers three concrete behaviors in the agreed execution order:

1. pinch resize for text and image layers in the main preview
2. two-finger rotate for text and image layers in the main preview
3. one-finger crop editing in the `Prepare image` modal on coarse-pointer devices

It does not introduce new inspector controls, new mobile toolbars, or new transform types beyond scale and rotation.

## Product Constraints

- Keep the existing quick mobile editing flow intact
- Reuse current visual affordances where they already exist
- Preserve desktop behavior and current mouse-based transform handles
- Do not refactor the whole preview gesture system before beta
- Keep crop in `Prepare image` as the same modal flow instead of creating a separate mobile screen

## Main Preview Gesture Contract

### Single-finger layer move

When the active layer is visible in the preview overlay and the user presses one finger inside that layer's transform box:

- the layer starts moving immediately
- this applies to both text and image layers
- existing desktop move behavior stays unchanged

### Two-finger layer transform upgrade

If that move session is already active and a second finger touches the preview anywhere, inside or outside the box:

- the interaction upgrades from one-finger move into a two-finger layer transform session
- the layer continues to translate based on the changing midpoint between the two fingers
- the layer scales based on the change in distance between the two fingers
- the layer rotates based on the change in angle between the two fingers

The session is allowed only when:

- `retouchMode` is `idle`
- scene crop mode is not active
- the first finger started on the active layer's transform box

### Gesture priority

The existing preview gesture behavior remains in place unless a valid layer transform session is active:

- empty-space touch still pans the preview
- empty-space two-finger touch still drives preview pinch zoom
- retouch modes keep priority over transform gestures
- scene crop mode keeps priority over transform gestures

This keeps current phone behaviors stable while adding a narrow new path only for active-layer manipulation.

## Geometry Rules For Layer Transform

### Session model

The two-finger layer transform should compute from a fixed session snapshot rather than accumulating deltas frame-by-frame.

The session stores:

- `layerId`
- `primaryPointerId`
- `secondaryPointerId`
- starting layer `box`
- starting layer center
- starting midpoint between the two fingers
- starting finger distance
- starting finger angle

### Translation

Layer translation is derived from:

- current midpoint minus starting midpoint

That delta is applied to the starting layer center, not to the progressively mutated box.

### Scale

Layer scale is derived from:

- current finger distance divided by starting finger distance

The scale factor applies uniformly to the starting box dimensions.

Existing minimum box limits remain in force so touch scaling cannot collapse a layer to zero or to an unusably small target.

### Rotation

Layer rotation is derived from:

- current finger angle minus starting finger angle

That delta is added to the starting layer rotation.

### Layer update path

Both text and image layers should continue using the existing `box` update path through `onLayerChange(..., 'defer')` so undo history and renderer behavior stay aligned with the rest of the editor.

## Architecture Boundary For Main Preview

The correct implementation seam is [src/features/preview/preview-canvas.tsx](/D:/PETS/meme-elf/src/features/preview/preview-canvas.tsx).

### Keep existing seams

Do not replace these current systems:

- `interactionRef` for existing mouse and single-pointer transform flows
- `pinchInteractionRef` for preview zoom/pan
- existing rotate handle and resize handles

### Add one new seam

Add a dedicated touch-layer-transform session that is separate from preview pinch state.

That separation matters because preview zoom and layer transform are different modes with different anchors:

- preview pinch anchors to canvas position and preview pan/zoom
- layer transform anchors to the active layer box

Keeping them separate reduces regression risk in the already-shipped phone preview behavior.

## Prepare Image Mobile Crop Contract

### Product behavior

The `Prepare image` modal should expose crop on phone instead of hiding it behind coarse-pointer detection.

The modal stays the same workflow:

- preview image
- rotate if needed
- flip if needed
- crop if needed
- confirm

No separate mobile crop route or extra modal layer is introduced.

### Touch crop behavior

On coarse-pointer devices:

- dragging on empty preview starts a new crop box
- dragging inside the crop box moves it
- dragging a corner handle resizes it

This is a one-finger interaction only.

### Explicit non-goals for this modal

Do not add:

- pinch zoom inside the modal
- two-finger rotate inside the modal
- gesture-based rotate in the modal

The existing rotate and flip buttons remain the transform controls there. That keeps the modal implementation narrow and low-risk.

## Architecture Boundary For Prepare Image

The correct implementation seam is [src/features/image/pre-insert-modal.tsx](/D:/PETS/meme-elf/src/features/image/pre-insert-modal.tsx).

### Current problem

Mobile crop is currently disabled by a coarse-pointer gate, even though the modal already has:

- crop overlay rendering
- crop box normalization
- move and resize math
- preview-to-source coordinate mapping

### Required change

Replace the mouse-only crop interaction path with pointer-based crop interaction and remove the coarse-pointer ban on crop availability.

### Interaction details

- crop overlay remains visually the same
- crop handles become touch-safe
- desktop mouse behavior continues to work through the same pointer-based path
- source-space crop math remains the source of truth

This should reuse the current crop-box geometry utilities instead of inventing a second mobile crop model.

## Hit Targets And Ergonomics

For `Prepare image` crop on phone:

- enlarge crop handles beyond the desktop-only target size
- allow comfortable drag starts on small images and narrow crops
- keep the overlay predictable rather than adding hidden gesture affordances

For main preview layer transform:

- do not require the second finger to land inside the box
- preserve the existing visible transform box and handles as the learnable affordance

## Error Handling And Exit Conditions

### Main preview

- if the second touch disappears, end the two-finger transform session cleanly
- if one-finger move remains after that end, do not try to resume a half-old move session; the user can start a fresh gesture
- if touch tracking becomes inconsistent, fail back to idle instead of leaving a stuck transform state

### Prepare image

- if pointer cancel fires during crop editing, stop the crop interaction without clearing the last valid crop box
- if a crop drag leaves the preview bounds, continue using clamped source coordinates

## Testing Strategy

### Main preview tests

Add or update tests in [src/features/preview/preview-canvas.test.ts](/D:/PETS/meme-elf/src/features/preview/preview-canvas.test.ts) to cover:

- first touch on active layer starts layer move rather than preview pan
- second touch joining that move upgrades into layer scale and rotation
- two-finger layer transform does not invoke preview pinch zoom callbacks
- empty-surface two-finger touch still invokes preview pinch zoom callbacks
- retouch and scene-crop modes still block layer transform gestures

### Prepare image tests

Update [src/features/image/pre-insert-modal.test.tsx](/D:/PETS/meme-elf/src/features/image/pre-insert-modal.test.tsx) to cover:

- coarse-pointer devices now show interactive crop handles
- pointer drag can create a crop box on the modal preview
- pointer drag can move an existing crop box
- pointer drag from a handle resizes an existing crop box

### Verification expectation

Before calling the work complete, run:

- targeted Vitest for preview gesture coverage
- targeted Vitest for `Prepare image` modal coverage
- full `npm run build`

Manual phone smoke is worth doing after implementation because both features are touch-first and hard to fully trust from jsdom alone.

## Manual Smoke Checklist

After implementation, validate on a real phone or phone-like touch environment:

1. select a text layer, drag with one finger, then add a second finger and confirm move + scale + rotation all update the same layer
2. repeat on an image layer
3. confirm two-finger pinch on empty preview still zooms the whole preview
4. confirm draw, erase, select, and scene crop still block layer-transform gestures
5. open `Prepare image` from a phone flow and confirm create, move, and resize crop all work with one finger
6. confirm rotate/flip buttons still work after a mobile crop edit

## Out Of Scope

This beta-closeout design does not include:

- gesture transforms for draw layers
- gesture-based resize from inactive layers
- gesture transforms in retouch modes
- gesture rotation or pinch zoom inside `Prepare image`
- a generalized preview gesture state machine rewrite
