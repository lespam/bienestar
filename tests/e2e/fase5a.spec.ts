import { test, expect } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

test('Recetario: buscar, ver una receta, ajustar la porción y tomar notas', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Comida', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await expect(page.getByRole('heading', { name: 'Recetario', level: 2 })).toBeFocused();

  // Las recetas del archivo se copiaron; los números empiezan ocultos
  await expect(page.getByRole('button', { name: /Tinga de pollo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tacos de champiñón/ })).toBeVisible();
  await expect(page.getByText('kcal aprox. por porción')).toHaveCount(0);
  await revisarPantalla(page);

  // Buscar por ingrediente y por tipo
  await page.getByRole('searchbox').fill('jitomate');
  await expect(page.getByRole('button', { name: /Tinga de pollo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tacos de champiñón/ })).toHaveCount(0);
  await page.getByRole('searchbox').fill('zzz');
  await expect(page.getByText('No hay recetas con «zzz»')).toBeVisible();
  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: /^Cenas · 1/ }).click();
  await expect(page.getByRole('button', { name: /Tinga de pollo/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^Todas · 2/ }).click();

  // Vista con viñetas
  await page.getByRole('switch', { name: 'Ver como viñetas con fotos' }).click();
  await expect(page.locator('.rc-card')).toHaveCount(2);
  await revisarPantalla(page);
  await page.getByRole('switch', { name: 'Ver como viñetas con fotos' }).click();

  // Detalle
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
  await expect(page.getByRole('heading', { name: 'Tinga de pollo', level: 2 })).toBeFocused();
  await expect(page.getByText('Calorías y macros ocultos.')).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Mostrar', exact: true }).click();
  await expect(page.getByText('290', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Más porciones' }).click();
  await expect(page.getByText('Cantidades para 5 porciones. La receta guardada no cambia.')).toBeVisible();
  await expect(page.getByText('630 g')).toBeVisible();
  await page.getByRole('button', { name: 'Más porciones' }).click();
  await page.getByRole('button', { name: 'Más porciones' }).click();
  await expect(page.getByText('Alcanza para 3 comidas de los dos y sobra 1 porción.')).toBeVisible();

  // Notas y tips, con Deshacer
  await page.getByLabel('Escribe una tip').fill('Deshebra el pollo caliente');
  await page.getByRole('button', { name: '+ Agregar', exact: true }).click();
  await expect(page.getByText('Deshebra el pollo caliente')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('Deshebra el pollo caliente')).toHaveCount(0);

  // Ajustar a una referencia: otro tamaño de porción para ella, solo en esta receta
  await page.getByRole('button', { name: /Ajustar a una referencia/ }).click();
  const aj = page.getByRole('dialog', { name: 'Ajustar la receta' });
  await aj.getByLabel('Para una comida').fill('150');
  await expect(aj.getByText('Cambiar el tamaño de tu porción')).toBeVisible();
  await expect(aj.getByText('Usa 1 cda de aceite en vez de 2')).toBeVisible();
  await revisarPantalla(page);
  await aj.getByRole('button', { name: 'Usar ½ porción' }).click();
  await expect(page.getByText('Cambiaste una porción solo en esta receta.')).toBeVisible();
  await page.getByRole('button', { name: 'Volver a las de sus perfiles' }).click();
  await expect(page.getByText('Salen de sus perfiles.')).toBeVisible();

  // Aplicar un cambio de ingredientes la vuelve "tu versión" y se puede regresar al original
  await page.getByRole('button', { name: /Ajustar a una referencia/ }).click();
  await page.getByRole('dialog', { name: 'Ajustar la receta' }).getByLabel('Para una comida').fill('150');
  // El aviso de Deshacer de arriba puede tapar el botón en pantallas altas: se toca por evento.
  await page.getByRole('button', { name: 'Aplicar' }).dispatchEvent('click');
  await expect(page.getByText('Tu versión')).toBeVisible();
  await expect(page.getByText('260', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a la receta original' }).click();
  await expect(page.getByText('Tu versión')).toHaveCount(0);
  await expect(page.getByText('290', { exact: true })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Recetario: pegar una receta, editarla y quitarla', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: '+ Agregar' }).click();
  const hoja = page.getByRole('dialog', { name: 'Agregar receta' });
  await expect(hoja).toBeVisible();
  await hoja.getByRole('tab', { name: 'Foto' }).click();
  await expect(hoja.getByText('Esta parte llega en la fase 8')).toBeVisible();
  await hoja.getByRole('tab', { name: 'Pegar' }).click();
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Usar una receta de ejemplo' }).click();
  await hoja.getByRole('button', { name: 'Separar en partes' }).click();
  await expect(hoja.getByText('Listo. Revisa cada parte y cambia lo que haga falta.')).toBeVisible();
  await expect(hoja.getByLabel('Nombre')).toHaveValue('Enfrijoladas de pollo');
  await expect(hoja.getByLabel('Rinde (porciones)')).toHaveValue('4');
  await expect(hoja.getByLabel('Ingredientes, uno por línea')).toHaveValue(/400 g de pechuga de pollo cocida/);
  // Con los números ocultos, no se piden pero se guardan
  await expect(hoja.getByText('Los números están ocultos. Si la receta los trae, se guardan igual.')).toBeVisible();
  await hoja.getByRole('button', { name: 'Guardar receta' }).click();
  await expect(page.getByRole('heading', { name: 'Enfrijoladas de pollo', level: 2 })).toBeVisible();
  await expect(page.getByText('Pegada de tus documentos')).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar', exact: true }).click();
  await expect(page.getByText('500', { exact: true })).toBeVisible();

  // Editar
  await page.getByRole('button', { name: 'Editar' }).click();
  const ed = page.getByRole('dialog', { name: 'Editar receta' });
  await ed.getByLabel('Nombre').fill('Enfrijoladas con pollo');
  await ed.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('heading', { name: 'Enfrijoladas con pollo', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('heading', { name: 'Enfrijoladas de pollo', level: 2 })).toBeVisible();

  // Quitarla del recetario y recuperarla con Deshacer
  await page.getByRole('button', { name: 'Quitar del recetario' }).click();
  await expect(page.getByRole('heading', { name: 'Recetario', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Enfrijoladas/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('button', { name: /Enfrijoladas/ })).toBeVisible();
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await expect(page.getByRole('button', { name: /Enfrijoladas/ })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Perfiles: referencias que escribes tú, calculadora del libro y lo que no se come', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Perfiles' }).click();
  await expect(page.getByRole('heading', { name: 'Perfiles', level: 2 })).toBeFocused();
  await expect(page.getByText('Los números están ocultos.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Mostrar', exact: true }).click();
  await expect(page.getByText('Sin referencia').first()).toBeVisible();

  // Una cifra muy baja no se guarda
  await page.getByRole('button', { name: 'Editar' }).click();
  const hoja = page.getByRole('dialog', { name: 'Tus referencias' });
  await hoja.getByLabel('Calorías al día', { exact: true }).fill('1000');
  await hoja.getByLabel('Calorías al día, hasta').fill('1100');
  await hoja.getByLabel('Calorías al día, hasta').blur();
  await expect(hoja.getByText('La app no guarda referencias de calorías tan bajas.')).toBeVisible();
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toBeVisible();
  await hoja.getByLabel('Calorías al día', { exact: true }).fill('1700');
  await hoja.getByLabel('Calorías al día, hasta').fill('1900');
  await hoja.getByLabel('Prot g').first().fill('110');
  await hoja.getByRole('radio', { name: 'Con nutrióloga' }).click();
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('1,700–1,900 kcal')).toBeVisible();
  await expect(page.getByText('Las definiste con tu nutrióloga')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('1,700–1,900 kcal')).toHaveCount(0);

  // Calculadora del libro (el peso no se guarda)
  await page.getByRole('button', { name: 'Abrir la calculadora' }).click();
  const calc = page.getByRole('dialog', { name: 'Calculadora del libro' });
  await expect(calc.getByRole('button', { name: 'Usar como mi referencia' })).toBeDisabled();
  await calc.getByLabel('Tu peso (lb)').fill('155');
  await expect(calc.getByText('1,860 kcal', { exact: true })).toBeVisible();
  await revisarPantalla(page);
  await calc.getByRole('button', { name: 'Usar como mi referencia' }).click();
  await expect(page.getByText('1,705–1,860 kcal')).toBeVisible();
  await expect(page.getByText('Las calculaste con el libro (Strong Curves)')).toBeVisible();

  // Porción de Jeff y lo que no come
  await page.getByRole('tab', { name: 'Jeff' }).click();
  await page.getByRole('button', { name: 'Porción más grande' }).click();
  await expect(page.getByText('1½ porciones')).toBeVisible();
  await page.getByRole('button', { name: '+ Agregar' }).nth(1).click();
  await page.getByLabel('Lo que no come: escribe uno nuevo').fill('champiñón');
  await page.getByLabel('Lo que no come: escribe uno nuevo').press('Enter');
  await expect(page.locator('.pf-chip', { hasText: 'Champiñón' })).toBeVisible();
  await page.getByLabel('Notas (opcional)').fill('Lleva comida al trabajo');
  await page.waitForTimeout(600);

  // El Recetario lo avisa, sin imponer nada
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await expect(page.getByText('Jeff no come champiñón')).toBeVisible();
  await page.getByRole('button', { name: /Tacos de champiñón/ }).click();
  await expect(page.getByText('Jeff no come champiñón. Cambia ese ingrediente en su porción.')).toBeVisible();
  await page.getByRole('button', { name: 'Ver perfiles ›' }).click();
  await page.getByRole('tab', { name: 'Jeff' }).click();
  await expect(page.getByText('1½ porciones')).toBeVisible();
  await expect(page.getByLabel('Notas (opcional)')).toHaveValue('Lleva comida al trabajo');
  expect(errores).toEqual([]);
});
