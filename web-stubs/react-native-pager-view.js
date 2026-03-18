import React, { forwardRef, useEffect, useImperativeHandle, useRef, Children } from 'react';
import { View } from 'react-native';

const PagerView = forwardRef(function PagerView(props, ref) {
  const { children, style, initialPage = 0, onPageSelected } = props;

  useEffect(() => {
    if (onPageSelected && initialPage != null) {
      onPageSelected({ nativeEvent: { position: initialPage } });
    }
  }, []);

  const innerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    setPage: (index) => {
      if (onPageSelected) {
        onPageSelected({ nativeEvent: { position: index } });
      }
    },
  }));

  const pages = Children.toArray(children);
  const activePage = pages[initialPage] || pages[0];

  return (
    <View ref={innerRef} style={style}>
      {activePage}
    </View>
  );
});

export default PagerView;
