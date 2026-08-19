import nextConfig from 'eslint-config-next';

const config = [
    ...nextConfig,
    {
        rules: {
            // This codebase uses the standard pre-React-Compiler "fetch on mount"
            // pattern throughout (useEffect(() => { fetchX() }, [])). It's not a
            // bug; it only matters once the React Compiler is adopted, which this
            // project does not use.
            'react-hooks/set-state-in-effect': 'off',
            // Simulates React Compiler's dependency inference vs. manual useCallback/
            // useMemo deps. Meaningless without the compiler actually enabled.
            'react-hooks/preserve-manual-memoization': 'off',
            // All flagged uses are dynamic, variable-sized user avatars. next/image
            // is a real performance win but requires converting ~30 call sites to
            // fill+sized-container layouts that can't be visually verified here.
            '@next/next/no-img-element': 'off',
        },
    },
];

export default config;
