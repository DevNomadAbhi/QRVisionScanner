import React from 'react';
import { StyleSheet, View, Text, Dimensions, PixelRatio, FlatList, Button } from 'react-native';
import {
  Camera,
  Point,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { Svg, Path, Circle } from 'react-native-svg';
export default function App(): React.ReactNode {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { width: screenWidthDIPs, height: screenHeightDIPs } = Dimensions.get('window');
  const pixelRatio = PixelRatio.get();
  const screenWidthPixels = screenWidthDIPs * pixelRatio;
  const screenHeightPixels = screenHeightDIPs * pixelRatio;
  const screenWidthPixelsRounded = Math.round(screenWidthPixels);
  const screenHeightPixelsRounded = Math.round(screenHeightPixels);

  const [isScanning, setIsScanning] = React.useState(false); // Scanning state
  const [boxes, setBoxes] = React.useState<
    { polygonPath: string, corners: Point[] }[]
  >([]);

  const [uniqueCodes, setUniqueCodes] = React.useState<
    { value: string; scanTime: number }[]
  >([]);

  // Timer to detect when no QR codes are in the frame
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: (codes, frame) => {
      if (isScanning) {
        if (timerRef.current) {
          clearTimeout(timerRef.current); // Reset timer on each call
        }

        if (codes.length > 0) {
          const startTime = Date.now();
          console.log(codes.length);
          // Update the bounding boxes for the current frame
          const newBoxes = codes.map((code) => {
            const polygonPath = code.corners
              .map((vertex) => `${(vertex.x * screenWidthPixelsRounded / frame.height) / pixelRatio},${(vertex.y * screenHeightPixelsRounded / frame.width) / pixelRatio} `)
              .join(' ');
            const corners = code.corners
              .map((corner) => {
                return {
                  x: (corner.x * screenWidthPixelsRounded / frame.height) / pixelRatio,
                  y: (corner.y * screenHeightPixelsRounded / frame.width) / pixelRatio
                }
              })
            return {
              polygonPath: polygonPath,
              corners: corners,
            };
          });
          console.log(JSON.stringify(newBoxes));
          setBoxes(newBoxes);

          const currentFrameValues = codes
            .map((code) => ({
              value: code.value,
              scanTime: Date.now() - startTime,
            }))
            .filter((data) => data.value !== undefined && data.value !== null);

          setUniqueCodes(currentFrameValues);

          // Restart the timer to clear boxes if no new QR codes are detected
          timerRef.current = setTimeout(() => {
            setBoxes([]);
            setUniqueCodes([]);
          }, 200); // 300ms timeout
        }
      }

    },
  });

  React.useEffect(() => {
    requestPermission();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current); // Clean up timer on unmount
      }
    };
  }, [requestPermission]);

  return (
    <View style={styles.container}>
      {hasPermission && device != null ? (
        <Camera
          device={device}
          style={StyleSheet.absoluteFill}
          isActive={true}
          codeScanner={codeScanner}
        />
      ) : (
        <Text>No Camera available or scanning is stopped.</Text>
      )}
      <Svg>
        {boxes.map((box, index) => (
          <Path key={index} d={`M${box.polygonPath}Z`} fill="transparent" stroke="#aaff00" strokeWidth={5} />
        ))}
      </Svg>
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>Scanned QR Codes</Text>
        <FlatList
          data={uniqueCodes}
          keyExtractor={(item, index) => `${item.value}-${index}`}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.codeText}>{item.value}</Text>
              <Text style={styles.timerText}>{item.scanTime} ms</Text>
            </View>
          )}
        />
        <View style={styles.buttonRow}>
          {isScanning ? (
            <Button title="Stop" onPress={() => setIsScanning(false)} />
          ) : (
            <Button title="Start" onPress={() => setIsScanning(true)} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    position: 'absolute',
    borderWidth: 5,
    borderColor: '#aaff00',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '40%',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  overlayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  codeText: {
    fontSize: 16,
    textAlign: 'left',
    flex: 1,
  },
  timerText: {
    fontSize: 14,
    textAlign: 'right',
    color: 'gray',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
});