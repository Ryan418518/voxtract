import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

const BAR_COUNT = 9;
const BAR_WIDTH = 5;
const BAR_GAP = 5;
const MAX_HEIGHT = 52;
const MIN_HEIGHT = 8;

// Natural-looking heights per bar (0–1 scale)
const BASE_HEIGHTS = [0.35, 0.6, 0.85, 1.0, 0.75, 0.95, 0.55, 0.7, 0.4];
// Stagger delay per bar in ms
const DELAYS = [0, 120, 60, 180, 90, 30, 150, 75, 210];
const DURATION = 700;

interface WaveformAnimationProps {
  active: boolean;
  color?: string;
  height?: number;
}

export function WaveformAnimation({
  active,
  color,
  height = MAX_HEIGHT,
}: WaveformAnimationProps) {
  const colors = useColors();
  const barColor = color ?? colors.primary;

  const anims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0))
  ).current;

  const loops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (active) {
      loops.current = anims.map((anim, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: DURATION + i * 20,
              delay: DELAYS[i],
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: DURATION + i * 20,
              useNativeDriver: false,
            }),
          ])
        );
        loop.start();
        return loop;
      });
    } else {
      loops.current.forEach((l) => l.stop());
      // Ease bars back to rest height
      Animated.parallel(
        anims.map((anim) =>
          Animated.timing(anim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          })
        )
      ).start();
    }

    return () => {
      loops.current.forEach((l) => l.stop());
    };
  }, [active, anims]);

  const totalWidth = BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP;

  return (
    <View style={[styles.container, { width: totalWidth, height }]}>
      {anims.map((anim, i) => {
        const restH = MIN_HEIGHT + BASE_HEIGHTS[i] * (height * 0.4 - MIN_HEIGHT);
        const activeH = MIN_HEIGHT + BASE_HEIGHTS[i] * (height - MIN_HEIGHT);

        const barHeight = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [restH, activeH],
        });

        const opacity = anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.45, 1, 0.8],
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                width: BAR_WIDTH,
                height: barHeight,
                backgroundColor: barColor,
                opacity: active ? opacity : 0.3,
                marginHorizontal: BAR_GAP / 2,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    borderRadius: 4,
  },
});
