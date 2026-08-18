// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // Kod tabani zaten "_" onekini 'bilerek kullanilmiyor' isareti olarak
      // kullaniyor (_dropped, _opts, _omitted); kural bunu tanisin.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Test dosyalari: supertest `res.body`, Prisma ham sonuclari ve jest mock
    // cagri kayitlari tip sisteminde `any` olarak gelir. Bu kurallari testlerde
    // hata saymak, uretim kodundaki GERCEK 18 hatayi 268 gurultunun icinde
    // gorunmez kiliyordu — lint sinyalini geri kazanmak icin uyariya cekildi.
    // src/ tarafinda kurallar AYNEN sikidir; gevsetme yalnizca test kapsaminda.
    files: ['test/**/*.ts', 'src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      // Sahte (fake) modul ve saglayicilar gercek imzayi taklit eder: senkron
      // olsalar da async kalmalari, atmalari beklenen degeri atmalari ve
      // jest.mock icinde require kullanmalari kasitlidir.
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/only-throw-error': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
    },
  },
);
