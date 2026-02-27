import React from 'react';
import { View } from 'react-native';

// This is a dummy screen. We intercept the tab press in _layout.tsx
// so the user never actually sees this screen, but Expo Router requires 
// the file to exist to render the tab button.
export default function SuggestScreen() {
    return <View />;
}
