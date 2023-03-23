import { Converter } from "./converter.mjs";

const error_block = document.querySelector("#error-block");
const error_title = document.querySelector("#error-title");
const error_code = document.querySelector("#error-code");
function display_error(section_title, body) {
	error_block.classList.remove("is-hidden");
	error_title.innerText = `Error reached during ${section_title}:`;

	// stop loading if in loading
	const level_loading = document.querySelector("#level-loading-label");
	level_loading.classList.add("is-hidden");

	const level_select = document.querySelector("#level-file-input");
	level_select.disabled = false;

	console.error(body);

	if (body instanceof Error && "stack" in body) {
		error_code.innerText = body.stack;
		return;
	}

	error_code.innerText = body;
}

function hide_error() {
	error_block.classList.add("is-hidden");
}

function on_file_input(file) {
	const reader = new FileReader();
	const loading_label = document.querySelector("#level-loading-label");
	const level_input = document.querySelector("#level-file-input");

	reader.addEventListener("load", async (event) => {
		try {
			await Converter.on_load_level(event.target.result);
			loading_label.classList.add("is-hidden");
		} catch(e) {
			display_error("level parse", e);
			return;
		}
	});

	reader.readAsText(file);

	hide_error();
	loading_label.classList.remove("is-hidden");
	level_input.disabled = true;
}

async function select_metagroup(name) {
	const group_select = document.querySelector("#active-groups-select");
	if (name == "none") {
		for (const option of group_select.children) {
			option.selected = false;
		}
	}

	const metagroup = await Converter.get_metagroup(name);
	if (!metagroup) {
		return;
	}

	for (const option of group_select.children) {
		option.selected = metagroup.includes(option.value);
	}
}

async function reset_state() {
	const info_element = document.querySelector("#level-info-element");
	info_element.classList.add("is-hidden");

	const report_element = document.querySelector("#conversion-report-element");
	report_element.classList.add("is-hidden");

	// reset loading labels
	document.querySelector("#level-loading-label").classList.add("is-hidden");

	const level_input = document.querySelector("#level-input-element");
	level_input.classList.remove("is-hidden");
	level_input_element.value = null;

	const level_select = document.querySelector("#level-file-input");
	level_select.disabled = false;

	// reset conversion level select
	const base_selector = document.querySelector("#conversion-level-select[value='base']");
	base_selector.checked = true;

	document.querySelector("#group-select-advanced").classList.add("is-hidden");
	document.querySelector("#metagroup-select").value = "base";

	await select_metagroup("base");

	hide_error();
	await Converter.reset_level();
}

const metagroup_select = document.querySelector("#metagroup-select");
metagroup_select.addEventListener("change", async (event) => {
	await select_metagroup(event.target.value);
});

const level_input_box = document.querySelector("#level-input-box");
level_input_box.addEventListener("dragenter", (event) => {
	event.stopPropagation();
	event.preventDefault();
}, false);
level_input_box.addEventListener("dragover", (event) => {
	event.stopPropagation();
	event.preventDefault();
}, false);
level_input_box.addEventListener("drop", (event) => {
	event.stopPropagation();
	event.preventDefault();

	// disable drag and drop if input is disabled
	const level_input = document.querySelector("#level-file-input");
	if (level_input.disabled) {
		return;
	}

	const data_transfer = event.dataTransfer;
	const file = data_transfer.files[0];

	if (file) {
		on_file_input(file);
	}
}, false);

const level_input_element = document.querySelector("#level-file-input");
level_input_element.addEventListener("change", () => {
	const input_file = level_input_element.files[0];

	if (input_file) {
		on_file_input(input_file);
	}
}, false);

const active_groups_select = document.querySelector("#active-groups-select");
active_groups_select.addEventListener("change", () => {
	const metagroup_select = document.querySelector("#metagroup-select");
	metagroup_select.value = "custom";
}, false);

document.querySelectorAll("#reset-button").forEach((b) => {
	b.addEventListener("click", async () => {
		await reset_state();
	}, false);
});

const run_convert_button = document.querySelector("#convert-level");
run_convert_button.addEventListener("click", async (event) => {
	event.target.disabled = true;

	const groups = Array.from(active_groups_select.selectedOptions).map(v => v.value);

	try {
		await Converter.run_conversion(groups);
	} catch (e) {
		display_error("level conversion", e);
		return;
	}
});

document.querySelectorAll("#conversion-level-select").forEach((e) => {
	e.addEventListener("change", async (event) => {
		// show/hide group select if custom select is chosen
		if (event.target.value != "custom") {
			document.querySelector("#group-select-advanced").classList.add("is-hidden");
		} else {
			document.querySelector("#group-select-advanced").classList.remove("is-hidden");
		}

		// sync metagroup selection with conversion selection
		document.querySelector("#metagroup-select").value = event.target.value;

		await select_metagroup(event.target.value);
	});
});

if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("/gdlevelconverter-web/service_worker.js");
}

async function main() {
	try {
		await Converter.initialize_engine();
	} catch (e) {
		display_error("loading engine", e);
		return;
	}

	const load_label = document.querySelector("#converter-loading-label");
	load_label.classList.add("is-hidden");

	const file_select = document.querySelector("#level-input-element");
	file_select.classList.remove("is-hidden");

	const file_input = document.querySelector("#level-file-input");
	file_input.disabled = false;

	const group_select = document.querySelector("#active-groups-select");
	group_select.innerHTML = "";

	const conversion_groups = await Converter.get_conversion_groups();

	for (const group of conversion_groups) {
		const option = document.createElement("option");
		option.value = group;
		option.innerText = group;

		group_select.appendChild(option);
	}

	group_select.disabled = false;

	await select_metagroup("base");
}

main();
