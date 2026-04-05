import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';

interface WheelProps {
  items: string[] | number[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  itemHeight?: number;
  visibleItemsCount?: number;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

const Wheel: React.FC<WheelProps> = ({
  items,
  selectedIndex,
  onIndexChange,
  itemHeight = ITEM_HEIGHT,
  visibleItemsCount = VISIBLE_ITEMS,
}) => {
  const flatListRef = useRef<FlatList>(null);
  const [localIndex, setLocalIndex] = useState(selectedIndex);

  // Pad the items at the top and bottom to center the middle items
  const paddingCount = Math.floor(visibleItemsCount / 2);
  const paddedItems = [
    ...Array(paddingCount).fill(''),
    ...items,
    ...Array(paddingCount).fill(''),
  ];

  useEffect(() => {
    // Initial scroll to the selected item
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: selectedIndex * itemHeight,
        animated: false,
      });
    }, 100);
  }, []);

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.y;
    const index = Math.round(offset / itemHeight);
    if (index !== localIndex) {
      setLocalIndex(index);
      onIndexChange(index);
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isPadded = item === '';
    const isSelected = index - paddingCount === localIndex;

    return (
      <View style={[styles.wheelItem, { height: itemHeight }]}>
        <Text
          style={[
            styles.wheelItemText,
            isSelected ? styles.wheelItemTextActive : styles.wheelItemTextInactive,
          ]}
        >
          {item}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ height: itemHeight * visibleItemsCount, flex: 1 }}>
      <FlatList
        ref={flatListRef}
        data={paddedItems}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        onMomentumScrollEnd={onMomentumScrollEnd}
        decelerationRate="fast"
        scrollEventThrottle={16}
      />
      {/* Selection bar overlay */}
      <View
        pointerEvents="none"
        style={[
          styles.selectionBar,
          {
            height: itemHeight,
            top: itemHeight * paddingCount,
          },
        ]}
      />
    </View>
  );
};

interface PremiumPickerProps {
  mode: 'date' | 'time';
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
}

export const PremiumWheelPicker: React.FC<PremiumPickerProps> = ({
  mode,
  value,
  onChange,
  onClose,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date(value));

  // Time components
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // Date components
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => (currentYear + i).toString());

  const handleTimeChange = (type: 'h' | 'm', index: number) => {
    const newDate = new Date(currentDate);
    if (type === 'h') newDate.setHours(index);
    else newDate.setMinutes(index);
    setCurrentDate(newDate);
    onChange(newDate);
  };

  const handleDateChange = (type: 'd' | 'm' | 'y', index: number) => {
    const newDate = new Date(currentDate);
    if (type === 'd') newDate.setDate(index + 1);
    else if (type === 'm') newDate.setMonth(index);
    else if (type === 'y') newDate.setFullYear(currentYear + index);
    setCurrentDate(newDate);
    onChange(newDate);
  };

  return (
    <View style={styles.container}>
      <View style={styles.wheelContainer}>
        {mode === 'time' ? (
          <>
            <Wheel
              items={hours}
              selectedIndex={currentDate.getHours()}
              onIndexChange={(i) => handleTimeChange('h', i)}
            />
            <Wheel
              items={minutes}
              selectedIndex={currentDate.getMinutes()}
              onIndexChange={(i) => handleTimeChange('m', i)}
            />
          </>
        ) : (
          <>
            <Wheel
              items={days}
              selectedIndex={currentDate.getDate() - 1}
              onIndexChange={(i) => handleDateChange('d', i)}
            />
            <Wheel
              items={monthNames}
              selectedIndex={currentDate.getMonth()}
              onIndexChange={(i) => handleDateChange('m', i)}
            />
            <Wheel
              items={years}
              selectedIndex={currentDate.getFullYear() - currentYear}
              onIndexChange={(i) => handleDateChange('y', i)}
            />
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    width: '100%',
    paddingVertical: 10,
  },
  wheelContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontSize: 22,
    fontWeight: '600',
  },
  wheelItemTextActive: {
    color: '#FFF',
    opacity: 1,
  },
  wheelItemTextInactive: {
    color: '#FFF',
    opacity: 0.2,
  },
  selectionBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
  },
});
