import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Tooltip from "react-native-walkthrough-tooltip";
import { useTheme } from "../theme/useTheme";

interface OnboardingTooltipProps {
  isVisible: boolean;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
  onNext: () => void;
  onClose?: () => void;
  children: React.ReactNode;
  isLastStep?: boolean;
  style?: any;
}

export const OnboardingTooltip: React.FC<OnboardingTooltipProps> = ({
  isVisible,
  content,
  placement = "bottom",
  onNext,
  onClose,
  children,
  isLastStep = false,
  style,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <Tooltip
      isVisible={isVisible}
      content={
        <View style={styles.tooltipContainer}>
          <Text style={styles.tooltipText}>{content}</Text>
          <View style={styles.buttonContainer}>
            {onClose && (
              <TouchableOpacity onPress={onClose} style={styles.skipButton}>
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onNext} style={styles.nextButton}>
              <Text style={styles.nextButtonText}>
                {isLastStep ? "Got it!" : "Next"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      placement={placement}
      onClose={() => {}} // Disable closing on background tap to prevent accidental tour skips!
      contentStyle={styles.contentStyle}
      backgroundColor="rgba(0,0,0,0.5)"
      childrenWrapperStyle={style}
    >
      {children}
    </Tooltip>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    contentStyle: {
      backgroundColor: theme.primary,
      borderRadius: 16,
      padding: 16,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 8,
    },
    tooltipContainer: {
      maxWidth: 250,
    },
    tooltipText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
      marginBottom: 16,
      lineHeight: 22,
    },
    buttonContainer: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 12,
    },
    skipButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    skipButtonText: {
      color: "rgba(255, 255, 255, 0.9)",
      fontSize: 14,
      fontWeight: "600",
      textDecorationLine: "underline",
    },
    nextButton: {
      backgroundColor: "#FFFFFF",
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    nextButtonText: {
      color: theme.primary,
      fontSize: 15,
      fontWeight: "bold",
    },
  });
