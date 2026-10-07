import { useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { chartGeometry } from "./reportChartData";

export function useLinkedChartScroll(timelineKey: string, count: number) {
  const nodes = useRef<Array<HTMLDivElement | null>>([]);
  const [widths, setWidths] = useState([760, 380, 380]);
  const geometry = chartGeometry(widths, count);
  const geometryRef = useRef(geometry);
  const position = useRef({ key: timelineKey, start: geometry.maxStart, atEnd: true });
  const written = useRef(new Map<HTMLDivElement, number>());
  const [start, setStart] = useState(geometry.maxStart);

  useLayoutEffect(() => {
    const measure = () => {
      const next = nodes.current.map((node) => node?.clientWidth ?? 380);
      if (next.length === 3 && next.every((width) => width > 0)) {
        setWidths((current) => next.every((width, i) => width === current[i]) ? current : next);
      }
    };
    const observer = new ResizeObserver(measure);
    nodes.current.forEach((node) => { if (node) observer.observe(node); });
    measure();
    return () => observer.disconnect();
  }, []);

  const sync = (nextStart: number, source?: HTMLDivElement) => {
    const current = geometryRef.current;
    const bounded = Math.max(0, Math.min(current.maxStart, nextStart));
    position.current.start = bounded;
    position.current.atEnd = bounded >= current.maxStart - 0.01;
    nodes.current.forEach((node, i) => {
      if (!node || node === source) return;
      node.scrollLeft = bounded * current.charts[i].step;
      // Remember the browser's rounded/clamped value, not the requested float.
      // Native scroll events from these writes must not feed back into the source.
      written.current.set(node, node.scrollLeft);
    });
    setStart(bounded);
  };

  useLayoutEffect(() => {
    geometryRef.current = chartGeometry(widths, count);
    const reset = position.current.key !== timelineKey;
    position.current.key = timelineKey;
    sync(reset || position.current.atEnd ? geometryRef.current.maxStart : position.current.start);
    // sync reads only refs and the stable state setter.
  }, [widths, count, timelineKey]);

  const onScroll = (index: number, event: UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    if (written.current.get(node) === node.scrollLeft) return;
    written.current.delete(node);
    // Every native scroll event counts, including a one-pixel wheel/trackpad move.
    // No debounce, minimum delta, timer, or smooth-scroll animation can lag behind.
    sync(node.scrollLeft / geometryRef.current.charts[index].step, node);
  };
  return { nodes, geometry, start, onScroll };
}
