import { cubicOut, cubicInOut, linear } from 'svelte/easing';
import { assign, is_function } from 'svelte/internal';

export type EasingFunction = (t: number) => number;

export interface TransitionConfig {
	delay?: number;
	duration?: number;
	easing?: EasingFunction;
	css?: (t: number, u: number) => string;
	tick?: (t: number, u: number) => void;
}

export interface BlurParams {
	delay?: number;
	duration?: number;
	easing?: EasingFunction;
	amount?: number;
	opacity?: number;
}

export function blur(node: Element, {
	delay = 0,
	duration = 400,
	easing = cubicInOut,
	amount = 5,
	opacity = 0
}: BlurParams = {}): TransitionConfig {
	const style = getComputedStyle(node);
	const target_opacity = +style.opacity;
	const f = style.filter === 'none' ? '' : style.filter;

	const od = target_opacity * (1 - opacity);

	return {
		delay,
		duration,
		easing,
		css: (_t, u) => `opacity: ${target_opacity - (od * u)}; filter: ${f} blur(${u * amount}px);`
	};
}

export interface FadeParams {
	delay?: number;
	duration?: number;
	easing?: EasingFunction;
}

export function fade(node: Element, {
	delay = 0,
	duration = 400,
	easing = linear
}: FadeParams = {}): TransitionConfig {
	const o = +getComputedStyle(node).opacity;

	return {
		delay,
		duration,
		easing,
		css: t => `opacity: ${t * o}`
	};
}

export interface FlyParams {
	delay?: number;
	duration?: number;
	easing?: EasingFunction;
	x?: number;
	y?: number;
	opacity?: number;
}

export function fly(node: Element, {
	delay = 0,
	duration = 400,
	easing = cubicOut,
	x = 0,
	y = 0,
	opacity = 0
}: FlyParams = {}): TransitionConfig {
	const style = getComputedStyle(node);
	const target_opacity = +style.opacity;
	const transform = style.transform === 'none' ? '' : style.transform;

	const od = target_opacity * (1 - opacity);

	return {
		delay,
		duration,
		easing,
		css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
	};
}

export interface SlideParams {
	delay?: number;
	duration?: number;
	easing?: EasingFunction;
}

export function slide(node: Element, {
	delay = 0,
	duration = 400,
	easing = cubicOut
}: SlideParams = {}): TransitionConfig {
	const style = getComputedStyle(node);
	const opacity = +style.opacity;
	const height = parseFloat(style.height);
	const padding_top = parseFloat(style.paddingTop);
	const padding_bottom = parseFloat(style.paddingBottom);
	const margin_top = parseFloat(style.marginTop);
	const margin_bottom = parseFloat(style.marginBottom);
	const border_top_width = parseFloat(style.borderTopWidth);
	const border_bottom_width = parseFloat(style.borderBottomWidth);

	return {
		delay,
		duration,
		easing,
		css: t =>
			'overflow: hidden;' +
			`opacity: ${Math.min(t * 20, 1) * opacity};` +
			`height: ${t * height}px;` +
			`padding-top: ${t * padding_top}px;` +
			`padding-bottom: ${t * padding_bottom}px;` +
			`margin-top: ${t * margin_top}px;` +
			`margin-bottom: ${t * margin_bottom}px;` +
			`border-top-width: ${t * border_top_width}px;` +
			`border-bottom-width: ${t * border_bottom_width}px;`
	};
}

export interface ScaleParams {
	delay?: number;
	duration?: number;
	easing?: EasingFunction;
	start?: number;
	opacity?: number;
}

export function scale(node: Element, {
	delay = 0,
	duration = 400,
	easing = cubicOut,
	start = 0,
	opacity = 0
}: ScaleParams = {}): TransitionConfig {
	const style = getComputedStyle(node);
	const target_opacity = +style.opacity;
	const transform = style.transform === 'none' ? '' : style.transform;

	const sd = 1 - start;
	const od = target_opacity * (1 - opacity);

	return {
		delay,
		duration,
		easing,
		css: (_t, u) => `
			transform: ${transform} scale(${1 - (sd * u)});
			opacity: ${target_opacity - (od * u)}
		`
	};
}

export interface DrawParams {
	delay?: number;
	speed?: number;
	duration?: number | ((len: number) => number);
	easing?: EasingFunction;
}

export function draw(node: SVGElement & { getTotalLength(): number }, {
	delay = 0,
	speed,
	duration,
	easing = cubicInOut
}: DrawParams = {}): TransitionConfig {
	const len = node.getTotalLength();

	if (duration === undefined) {
		if (speed === undefined) {
			duration = 800;
		} else {
			duration = len / speed;
		}
	} else if (typeof duration === 'function') {
		duration = duration(len);
	}

	return {
		delay,
		duration,
		easing,
		css: (t, u) => `stroke-dasharray: ${t * len} ${u * len}`
	};
}

export interface CrossfadeParams {
	delay?: number;
	duration?: number | ((len: number) => number);
	easing?: EasingFunction;
}

type ClientRectMap = Map<any, Element>;

export function crossfade({ fallback, ...defaults }: CrossfadeParams & {
	fallback?: (node: Element, params: CrossfadeParams, intro: boolean) => TransitionConfig;
}) {
	const to_receive: ClientRectMap = new Map();
	const to_send: ClientRectMap = new Map();

	// To calculate the opacity to make the top element and bottom element blend linearly
	function alphablend(to: number, from: number, t: number) {
		const retval: {to: number, from: number} = {to: -1, from: -1};
		const targetOpacity = ( to - from ) * t + from;

		// Based on the blending formula here. (http://en.wikipedia.org/wiki/Alpha_compositing#Alpha_blending)
		// This is a quadratic blending function that makes the top layer and bottom layer blend linearly.
		// However there is an asymptote at target=1 so that needs to be handled with an if else statement.
		if ( targetOpacity === 1 ) {
			retval.to = t;
			retval.from = 1;
		} else {
			retval.from = targetOpacity - ( t * t * targetOpacity );
			retval.to = ( targetOpacity - retval.from ) / ( 1 - retval.from );
		}

		return retval;
	}

	function crossfade(otherNode: Element, node: Element, params: CrossfadeParams, toDirection: boolean): TransitionConfig {
		const {
			delay = 0,
			duration = d => Math.sqrt(d) * 30,
			easing = cubicOut
		} = assign(assign({}, defaults), params);

		const to = node.getBoundingClientRect();
		const from = otherNode.getBoundingClientRect();
		const dx = from.left - to.left;
		const dy = from.top - to.top;
		const dw = from.width / to.width;
		const dh = from.height / to.height;
		const d = Math.sqrt(dx * dx + dy * dy);

		const style = getComputedStyle(node);
		const transform = style.transform === 'none' ? '' : style.transform;

		const otherStyle = getComputedStyle(otherNode);

		const toOpacity = toDirection ? +style.opacity : +otherStyle.opacity;
		const fromOpacity = toDirection ? +otherStyle.opacity : +style.opacity;

		return {
			delay,
			duration: is_function(duration) ? duration(d) : duration,
			easing,
			css: (t, u) => `
				opacity: ${toDirection ? alphablend(toOpacity, fromOpacity, t).to
							: alphablend(toOpacity, fromOpacity, 1 - t).from};
				transform-origin: top left;
				transform: ${transform} translate(${u * dx}px,${u * dy}px) scale(${t + (1 - t) * dw}, ${t + (1 - t) * dh});
			`
		};
	}

	function transition(items: ClientRectMap, counterparts: ClientRectMap, intro: boolean, toDirection: boolean) {
		return (node: Element, params: CrossfadeParams & { key: any }) => {
			items.set(params.key, node);

			return () => {
				if (counterparts.has(params.key)) {
					const counterpartNode = counterparts.get(params.key);
					counterparts.delete(params.key);

					return crossfade(counterpartNode, node, params, toDirection);
				}

				// if the node is disappearing altogether
				// (i.e. wasn't claimed by the other list)
				// then we need to supply an outro
				items.delete(params.key);
				return fallback && fallback(node, params, intro);
			};
		};
	}

	return [
		transition(to_send, to_receive, false, false),
		transition(to_receive, to_send, true, true)
	];
}
